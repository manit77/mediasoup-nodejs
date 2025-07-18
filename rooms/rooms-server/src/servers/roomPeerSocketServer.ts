import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import {
    AuthUserNewTokenMsg,
    payloadTypeClient,
    payloadTypeServer,
    RegisterPeerMsg,
    TerminatePeerMsg,
    UnauthorizedMsg
} from "@rooms/rooms-models";
import { RoomServer, RoomServerConfig } from '../roomServer/roomServer.js';
import * as roomUtils from "../roomServer/utils.js";
import { AuthUserRoles } from '../models/tokenPayloads.js';
import { setTimeout, setInterval } from 'node:timers';

const DSTR = "RoomSocketServer";

export type RoomPeerSocketSecurityMap = {
    [key in payloadTypeClient | payloadTypeServer]: AuthUserRoles[];
};

export let defaultPeerSocketServerSecurityMap: RoomPeerSocketSecurityMap = {} as any;
defaultPeerSocketServerSecurityMap[payloadTypeClient.authUserNewToken] = [AuthUserRoles.admin, AuthUserRoles.user]; //only valid users can create a new authtoken
defaultPeerSocketServerSecurityMap[payloadTypeClient.registerPeer] = []; //any one can register
defaultPeerSocketServerSecurityMap[payloadTypeClient.connectConsumerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.connectProducerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomConsumeStream] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.createConsumerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.createProducerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomProduceStream] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomProducerToggleStream] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomJoin] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomLeave] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomNew] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomNewToken] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomTerminate] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.terminatePeer] = [AuthUserRoles.user];

export class RoomPeerSocketServer {

    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();
    disconnectedPeers = new Map<string, WebSocket>();

    constructor(private config: RoomServerConfig, private securityMap: RoomPeerSocketSecurityMap, private roomServer: RoomServer) {
        roomServer.addEventListner((peerId: string, msg: any) => {
            let socket = this.peers.get(peerId);
            if (socket) {
                if (msg.type == payloadTypeClient.terminatePeer) {
                    console.log("socket closed");
                    socket.close();
                    this.peers.delete(peerId);
                    return;
                }
                this.send(socket, msg);

            } else {
                console.log("peer not found for message: " + msg.type);
            }
        });

    }

    async init(socketServer: WebSocketServer) {

        console.log("initWebSocket");
        this.webSocketServer = socketServer;

        this.webSocketServer.on('connection', (ws) => {

            console.log("socket connected peers: " + this.peers.size);

            ws.on('message', async (message) => {
                try {
                    await this.onMessage(ws, message);
                } catch (err) {
                    console.error("ERROR PROCESSING MSG");
                    console.error(err);
                }
            });

            ws.on('close', () => {
                this.onWebSocketClosed(ws);
            });
        });
    }

    async onMessage(ws: WebSocket, message: any) {
        try {

            console.log("msgIn, ", message.toString());
            const msgIn = JSON.parse(message.toString());

            if (msgIn.type == payloadTypeClient.registerPeer) {
                //we need to tie the peerid to the socket
                //the client should already have an authtoken
                let registerResult = await this.roomServer.onRegisterPeer(msgIn);
                if (registerResult.data.peerId) {
                    //store the authtoken in the socket
                    ws["room_authtoken"] = (msgIn as RegisterPeerMsg)?.data?.authToken;
                    //add the peer to peers
                    this.peers.set(registerResult.data.peerId, ws);
                    this.send(ws, registerResult);
                    console.log("socket registered:" + registerResult.data.peerId);
                } else {
                    console.error(DSTR, "register failed, no peerid for socket.");
                }
            } else {
                let peerid = this.findPeerBySocket(ws);
                if (peerid) {
                    //inject the authtoken from the socket
                    let authToken = ws["room_authtoken"];

                    let errMsg = this.validateMsgRoute(authToken, msgIn);
                    if (errMsg) {
                        this.send(ws, errMsg);
                        return errMsg;
                    }

                    msgIn.data.authToken = authToken;
                    let resultMsg = await this.roomServer.inMessage(peerid, msgIn);
                    if (resultMsg) {
                        this.send(ws, resultMsg);
                    }
                    return resultMsg;
                } else {
                    console.log(`${msgIn.type} peer not found by socket`);
                    console.log(this.peers);
                }
            }
        } catch (err) {
            console.error(err);
            console.log(message);
        }
    }

    async onWebSocketClosed(ws: WebSocket) {
        //when the socket closes terminate the peers transports 
        console.log("onWebSocketClosed");
        let peerid = this.findPeerBySocket(ws);
        if (peerid) {
            this.peers.delete(peerid);
            let msg = new TerminatePeerMsg();
            msg.data.peerId = peerid;
            this.roomServer.onTerminatePeer(peerid, msg);
        } else {
            console.log(`peer not found. ${peerid}`);
        }
    }

    private findPeerBySocket(socket: WebSocket): string {
        for (const [peerId, ws] of this.peers) {
            if (ws === socket) {
                return peerId;
            }
        }
        return "";
    }

    private async send(ws: WebSocket, msg: any) {
        console.log('send ', msg);
        if (msg) {
            ws.send(JSON.stringify(msg));
        } else {
            console.error("nothing to send.");
        }
    }

    private validateMsgRoute(authToken: string, msgIn: any): UnauthorizedMsg {
        //validate the autoken
        if (!authToken) {
            console.error("no authToken");
            let errMsg = new UnauthorizedMsg();
            errMsg.data.error = "authToken required.";
            return errMsg;
        }

        let payload = roomUtils.validateAuthUserToken(this.config.room_secretKey, authToken);
        if (!payload) {
            console.error("invalid authToken.");
            let errMsg = new UnauthorizedMsg();
            errMsg.data.error = "invalid authToken.";
            return errMsg;
        }

        //check the security map
        let secMap = this.securityMap[msgIn.type];
        if (!secMap || (secMap.length > 0 && !secMap.includes(payload.role))) {
            console.error("unauthorized");
            let errMsg = new UnauthorizedMsg();
            errMsg.data.error = "unauthorized access.";
            return errMsg;
        }

        return null;
    }

}