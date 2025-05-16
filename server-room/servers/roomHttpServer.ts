import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {    
    RegisterMsg,  
    RoomNewMsg,  
    RoomNewTokenMsg,
    RoomServerAPIRoutes,
    RoomTerminateMsg,
    TerminatePeerMsg
} from '../models/roomSharedModels';
import { RoomServer } from '../roomServer/roomServer';

const DSTR = "RoomHTTPServer";

export class RoomHTTPServer {

    //conference application server <----> room server
    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private app: express.Express, private roomServer: RoomServer) {

        app.get("/hello", (req, res) => {
            res.send("RoomHTTPServer");
        });
        
        app.post(RoomServerAPIRoutes.newRoomToken, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoomToken);
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body as RoomNewTokenMsg;
            res.send(this.newRoomToken(msgIn));
        });

        app.post(RoomServerAPIRoutes.newRoom, async (req, res) => {
            console.log(RoomServerAPIRoutes.newRoom);
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body as RoomNewMsg;
            res.send(this.newRoom(msgIn));
        });


        app.post(RoomServerAPIRoutes.terminateRoom, async (req, res) => {
            console.log(RoomServerAPIRoutes.terminateRoom);
            //conferencing server requests to destroy a room
            let msgIn = req.body as RoomTerminateMsg;
            res.send(this.terminateRoom(msgIn));
        });

    }

    registerPeer = async (msg: RegisterMsg) => {
        return this.roomServer.onRegister("", msg);
    }

    terminatePeer = (msg: TerminatePeerMsg) => {
        return this.roomServer.onTerminatePeer(msg);
    }

    newRoomToken = (msg: RoomNewTokenMsg) => {
        return this.roomServer.roomNewToken(msg);
    }

    newRoom = (msg: RoomNewMsg) => {
        return this.roomServer.roomNew(msg);
    }

    terminateRoom = (msg: RoomTerminateMsg) => {
        return this.roomServer.onRoomTerminate(msg);
    }    

}