import express, { NextFunction, Request, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
    AuthUserNewTokenMsg,
    RoomNewMsg,
    RoomNewTokenMsg,
    RoomServerAPIRoutes,
    RoomTerminateMsg,
    AuthUserRoles,
    IMsg,
    RoomGetStatusMsg,
} from "@rooms/rooms-models";
import { RoomServer } from '../roomServer/roomServer.js';
import * as roomUtils from "../roomServer/utils.js";
import { RoomServerConfig } from '../roomServer/models.js';
import { RecMsgTypes } from '../recording/recModels.js';

const DSTR = "RoomAPIServer";

declare module 'express-serve-static-core' {
    interface Request {
        rooms_authtoken?: string; // Add your custom property
    }
}

export type RoomAPIServerSecurityMap = {
    [key in RoomServerAPIRoutes]: AuthUserRoles[];
};

export let defaultHTTPServerSecurityMap: RoomAPIServerSecurityMap = {} as any;
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newAuthUserToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newRoomToken] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.newRoom] = [AuthUserRoles.admin];
defaultHTTPServerSecurityMap[RoomServerAPIRoutes.terminateRoom] = [AuthUserRoles.admin];

/**
 * these are admin functions of the room server
 */
export class RoomAPIServer {

    //application server <----> room server
    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private config: RoomServerConfig, private securityMap: RoomAPIServerSecurityMap, private roomServer: RoomServer) {

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
            req.rooms_authtoken = authtoken;

            //this requires admin access
            if (!authtoken) {
                console.error(DSTR, "authToken required.");
                return res.status(401).json({ error: 'Missing or invalid authToken' });
            }

            let payload = roomUtils.decodeAuthUserToken(this.config.room_secretKey, authtoken);
            if (!payload) {
                console.error(DSTR, "invalid authToken.");
                return res.status(401).json({ error: 'invalid authToken.' });
            }

            let secMap = this.securityMap[req.path];
            if (!secMap || (secMap.length > 0 && !secMap.includes(payload.role))) {
                console.error(DSTR, "unauthorized authToken.");
                return res.status(401).json({ error: 'unauthorized.' });
            }

            next();
        } catch (error) {
            console.error(DSTR, error);
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
    };

    init(app: express.Express) {
        console.log(`RoomAPIServer initialized.`);

        app.get("/hello", (req, res) => {
            res.send("RoomAPIServer");
        });

        app.post(RoomServerAPIRoutes.newAuthUserToken, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newAuthUserToken);
            let msgIn = req.body as AuthUserNewTokenMsg;

            let resultMsg = await this.roomServer.inServiceMsg(msgIn)

            res.send(resultMsg);

        });

        app.post(RoomServerAPIRoutes.newRoomToken, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoomToken);
            let msgIn = req.body as RoomNewTokenMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = await this.roomServer.inServiceMsg(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.newRoom, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoom);
            let msgIn = req.body as RoomNewMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            //creates a room without a peerId
            let resultMsg = await this.roomServer.inServiceMsg(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.getRoomStatus, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.getRoomStatus);

            let msgIn = req.body as RoomGetStatusMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = this.roomServer.inServiceMsg(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.terminateRoom, this.tokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.terminateRoom);
            let msgIn = req.body as RoomTerminateMsg;
            msgIn.data.authToken = req.rooms_authtoken;

            let resultMsg = this.roomServer.inServiceMsg(msgIn);
            res.send(resultMsg);
        });

        app.post(RoomServerAPIRoutes.recCallBack, async (req, res) => {
            console.log(RoomServerAPIRoutes.recCallBack);

            let msgIn = req.body as IMsg;
            switch (msgIn.type) {
                case RecMsgTypes.recReady:
                case RecMsgTypes.recPacketRecorded:
                case RecMsgTypes.recFailed:
                case RecMsgTypes.recDone:
                case RecMsgTypes.recRoomStatus: {
                    //recording port is open send recording
                    var result = await this.roomServer.inServiceMsg(msgIn);
                    res.status(200).send(result).end();
                    return;
                }
            }

            res.status(400).send({ type: "error", data: { error: "invalid message." } }).end();

            // msgIn.data.authToken = req.rooms_authtoken;

            // let resultMsg = this.roomServer.terminateRoom(msgIn);
            // res.send(resultMsg);
        });

        // app.post(RoomServerAPIRoutes.getRoomLogs, this.tokenCheck as any, async (req, res) => {
        //     console.log(RoomServerAPIRoutes.getRoomLogs);
        //     let msgIn = req.body as RoomTerminateMsg;
        //     msgIn.data.authToken = req.rooms_authtoken;

        //     let resultMsg = this.roomServer.onRoomTerminateMsg(msgIn);
        //     res.send(resultMsg);
        // });


    }

}