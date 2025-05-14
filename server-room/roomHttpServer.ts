import express from 'express';
import { WebSocket, WebSocketServer } from 'ws';
import {
    payloadTypeClient,
    RegisterMsg,
    RoomJoinMsg,
    RoomLeaveMsg,
    RoomNewMsg,
    RoomNewTokenMsg,
    RoomTerminateMsg,
    TerminatePeerMsg
} from './roomSharedModels';
import { RoomServer } from './roomServer';
import { JoinMsg } from '../client-webrtc/common/conferenceSharedModels';

const DSTR = "RoomHTTPServer";

export class RoomHTTPServer {

    //conference application server <----> room server
    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private app: express.Express, private roomServer: RoomServer) {

        app.get("/hello", (req, res) => {
            res.send("RoomHTTPServer");
        });
        
        app.post("/newRoomToken", async (req, res) => {
            //conferencing server requests an authtoken to be created, doesnt create an actual room
            //returns the auth token
            //returns the signaling info
            let msgIn = req.body as RoomNewTokenMsg;
            res.send(this.newRoomToken(msgIn));
        });     

        app.post("/terminateRoom", async (req, res) => {
            //conferencing server requests to destroy a room
            let msgIn = req.body as RoomTerminateMsg;
            res.send(this.terminateRoom(msgIn));
        });

    }

    registerPeer = async (msg: RegisterMsg) => {
        return this.roomServer.onRegister(msg.data.peerId, msg);
    }

    terminatePeer = (msg: TerminatePeerMsg) => {
        return this.roomServer.onTerminatePeer(msg);
    }

    newRoomToken = (msg: RoomNewTokenMsg) => {
        return this.roomServer.onRoomNewToken(msg.data.peerId, msg);
    }

    terminateRoom = (msg: RoomTerminateMsg) => {
        return this.roomServer.onRoomTerminate(msg);
    }    

}