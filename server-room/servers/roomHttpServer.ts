import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
    AuthUserNewTokenMsg,
    AuthUserNewTokenResultMsg,
    RoomNewMsg,
    RoomNewTokenMsg,
    RoomServerAPIRoutes,
    RoomTerminateMsg,
} from '../models/roomSharedModels';
import { RoomServer, RoomServerConfig } from '../roomServer/roomServer';
import { AuthUserRoles, AuthUserTokenPayload } from '../models/tokenPayloads';
import { jwtVerify } from '../../server-conference/jwtUtil';
import * as roomUtils from "../roomServer/utils";

const DSTR = "RoomHTTPServer";

declare module 'express-serve-static-core' {
    interface Request {
        rooms_authtoken?: string; // Add your custom property
    }
}

export type RoomHTTPServerSecurityMap = {
    [key in RoomServerAPIRoutes]: AuthUserRoles[];
};

export let defaultHTTPServerSecurityMap: RoomHTTPServerSecurityMap; 
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newAuthUserToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newRoomToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newRoomToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.terminateRoom] = [AuthUserRoles.admin];

/**
 * these are admin functions of the room server
 */
export class RoomHTTPServer {

    //application server <----> room server
    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private config: RoomServerConfig, private securityMap: RoomHTTPServerSecurityMap, private app: express.Express, private roomServer: RoomServer) {

        const tokenCheck = (req: Request, res: Response, next: NextFunction) => {
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

        app.get("/hello", (req, res) => {
            res.send("RoomHTTPServer");
        });

        app.post(RoomServerAPIRoutes.newAuthUserToken, tokenCheck as any, async (req, res) => {

            console.log(RoomServerAPIRoutes.newAuthUserToken);
            let msgIn = req.body as AuthUserNewTokenMsg;
            msgIn.data.authToken = req.rooms_authtoken;            

            let resultMsg = this.roomServer.onAuthUserNewToken(msgIn)
            res.send(resultMsg);

        });

        app.post(RoomServerAPIRoutes.newRoomToken, tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoomToken);
            let msgIn = req.body as RoomNewTokenMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = this.roomServer.roomNewToken(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.newRoom, tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoom);
            let msgIn = req.body as RoomNewMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            //creates a room without a peerId
            let resultMsg = this.roomServer.onRoomNewNoPeer(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.terminateRoom, tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.terminateRoom);
            let msgIn = req.body as RoomTerminateMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = this.roomServer.onRoomTerminate(msgIn);
            res.send(resultMsg);
        });

    }

}