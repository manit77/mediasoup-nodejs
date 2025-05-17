import express, { NextFunction, Response } from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
    AuthUserNewTokenMsg,
    RegisterMsg,
    RoomNewMsg,
    RoomNewTokenMsg,
    RoomServerAPIRoutes,
    RoomTerminateMsg,
    TerminatePeerMsg
} from '../models/roomSharedModels';
import { RoomServer } from '../roomServer/roomServer';
import { AuthUserRoles, AuthUserTokenPayload } from '../models/tokenPayloads';
import { jwtVerify } from '../../server-conference/jwtUtil';

const DSTR = "RoomHTTPServer";

/**
 * these are admin functions of the room server
 */
export class RoomHTTPServer {

    //application server <----> room server
    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    config = {
        secretKey: "IFXBhILlrwNGpOLK8XDvvgqrInnU3eZ1", //override with your secret key from a secure location
    }

    constructor(private app: express.Express, private roomServer: RoomServer) {

        const adminTokenCheck = (req: Request, res: Response, next: NextFunction) => {
            const authHeader = req.headers['authorization'];
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ error: 'Missing or invalid Authorization header' });
            }
            const authtoken = authHeader.split(' ')[1];
            try {
                //store the auth token in the request obj
                req["rooms_authtoken"] = authtoken;
                next();
            } catch (error) {
                return res.status(401).json({ error: 'Invalid or expired token' });
            }
        };


        app.get("/hello", (req, res) => {
            res.send("RoomHTTPServer");
        });

        app.post(RoomServerAPIRoutes.newAuthUserToken, adminTokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newAuthUserToken);
            let msgIn = req.body as AuthUserNewTokenMsg;
            msgIn.data.accessToken = req["rooms_authtoken"];
            res.send(this.newAuthUserToken(msgIn));
        });

        app.post(RoomServerAPIRoutes.newRoomToken, adminTokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoomToken);
            let msgIn = req.body as RoomNewTokenMsg;
            msgIn.data.authToken = req["rooms_authtoken"];
            res.send(this.newRoomToken(msgIn));
        });

        app.post(RoomServerAPIRoutes.newRoom, adminTokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoom);
            let msgIn = req.body as RoomNewMsg;
            msgIn.data.authToken = req["rooms_authtoken"];
            res.send(this.newRoom(msgIn));
        });

        app.post(RoomServerAPIRoutes.terminateRoom, adminTokenCheck as any, async (req, res) => {
            console.log(RoomServerAPIRoutes.terminateRoom);
            let msgIn = req.body as RoomTerminateMsg;
            msgIn.data.authToken = req["rooms_authtoken"];
            res.send(this.terminateRoom(msgIn));
        });

    }

    registerPeer = async (msg: RegisterMsg) => {
        return this.roomServer.onRegister("", msg);
    }

    terminatePeer = (msg: TerminatePeerMsg) => {
        return this.roomServer.onTerminatePeer(msg);
    }

    newAuthUserToken = (msg: AuthUserNewTokenMsg) => {
        return this.roomServer.onAuthUserNewToken(msg);
    }

    newRoomToken = (msg: RoomNewTokenMsg) => {
        return this.roomServer.roomNewToken(msg);
    }

    newRoom = (msg: RoomNewMsg) => {
        return this.roomServer.onRoomNewNoPeer(msg);
    }

    terminateRoom = (msg: RoomTerminateMsg) => {
        return this.roomServer.onRoomTerminate(msg);
    }

}