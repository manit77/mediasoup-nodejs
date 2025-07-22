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
import { consoleError, consoleLog, consoleWarn } from '../utils/utils.js';

const LOG = "RoomSocketServer";

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

export class SocketConnection {
    peerId: string;
    displayName: string;
    ws: WebSocket;
    room_authtoken: string;
}

export class RoomPeerSocketServer {

    webSocketServer: WebSocketServer;
    connections = new Map<WebSocket, SocketConnection>();

    constructor(private config: RoomServerConfig, private securityMap: RoomPeerSocketSecurityMap, private roomServer: RoomServer) {
        roomServer.addEventListener((peerId: string, msg: any) => {
            let conn = [...this.connections.values()].find(c => c.peerId == peerId);
            if (conn) {
                if (msg.type == payloadTypeClient.terminatePeer) {
                    consoleLog(LOG, "terminatePeer");
                    conn.ws?.close();
                    this.connections.delete(conn.ws);
                    return;
                }
                this.send(conn.ws, msg);

            } else {
                consoleLog(LOG, "peer not found for message: " + msg.type);
            }
        });
    }

    async init(socketServer: WebSocketServer) {

        consoleLog(LOG, "initWebSocket");
        this.webSocketServer = socketServer;

        this.webSocketServer.on('connection', (ws) => {

            let newConnection = new SocketConnection();
            newConnection.ws = ws;
            this.connections.set(ws, newConnection);

            consoleLog(LOG, "socket connected connections: " + this.connections.size);

            ws.on('message', async (message) => {
                try {
                    consoleLog(LOG, "msgIn, ", message.toString());
                    const msgIn = JSON.parse(message.toString());
                    if (msgIn.type === payloadTypeClient.authUserNewToken) {
                        let resultMsg = this.roomServer.onAuthUserNewTokenMsg(msgIn);
                        this.send(ws, resultMsg);
                        return;
                    } else if (msgIn.type == payloadTypeClient.registerPeer) {
                        if (newConnection.peerId) {
                            consoleWarn(`connection already registered. ${newConnection.peerId}, ${newConnection.displayName}`);
                            let registerResult = await this.roomServer.onRegisterPeer(msgIn);
                            this.send(ws, registerResult);
                            return;
                        }
                        //we need to tie the peerid to the socket
                        //the client should already have an authtoken
                        let registerResult = await this.roomServer.onRegisterPeer(msgIn);
                        if (registerResult.data.peerId) {
                            //store the authtoken in the socket                           
                            newConnection.peerId = registerResult.data.peerId;
                            newConnection.displayName = registerResult.data.displayName;
                            newConnection.room_authtoken = (msgIn as RegisterPeerMsg)?.data?.authToken;

                            this.send(ws, registerResult);
                            consoleLog(LOG, "socket registered:" + registerResult.data.peerId);
                        } else {
                            consoleError(LOG, "register failed, no peerid for socket.");
                        }
                    } else {
                        let conn = this.connections.get(ws);
                        if (conn.peerId) {
                            //inject the authtoken from the socket
                            let authToken = conn.room_authtoken;

                            let errMsg = this.validateMsgRoute(authToken, msgIn);
                            if (errMsg) {
                                this.send(ws, errMsg);
                                return errMsg;
                            }

                            msgIn.data.authToken = authToken;
                            let resultMsg = await this.roomServer.inMessage(conn.peerId, msgIn);
                            if (resultMsg) {
                                this.send(ws, resultMsg);
                            }
                            return resultMsg;
                        } else {
                            consoleLog(`${msgIn.type} peer not found by socket`);

                        }
                    }

                } catch (err) {
                    consoleError(LOG, "ERROR PROCESSING MSG");
                    consoleError(LOG, err);
                }
            });

            ws.on('close', () => {
                this.onWebSocketClosed(ws);
            });
        });
    }

    async onWebSocketClosed(ws: WebSocket) {
        //when the socket closes terminate the peers transports 
        consoleLog(LOG, "onWebSocketClosed");
        let conn = this.connections.get(ws);
        this.connections.delete(ws);
        if (conn) {
            let msg = new TerminatePeerMsg();
            msg.data.peerId = conn.peerId;
            this.roomServer.onTerminatePeer(conn.peerId, msg);
        } else {
            consoleWarn(`onWebSocketClosed, peer not found`);
        }
    }


    private async send(ws: WebSocket, msg: any) {
        consoleLog(LOG, "send ", msg);
        if (msg) {
            ws.send(JSON.stringify(msg));
        } else {
            console.error("nothing to send.");
        }
    }

    private validateMsgRoute(authToken: string, msgIn: any): UnauthorizedMsg {
        //validate the autoken
        if (!authToken) {
            consoleError(LOG, "no authToken");
            let errMsg = new UnauthorizedMsg();
            errMsg.data.error = "authToken required.";
            return errMsg;
        }

        let payload = roomUtils.validateAuthUserToken(this.config.room_secretKey, authToken);
        if (!payload) {
            consoleError(LOG, "invalid authToken.");
            let errMsg = new UnauthorizedMsg();
            errMsg.data.error = "invalid authToken.";
            return errMsg;
        }

        //check the security map
        let secMap = this.securityMap[msgIn.type];
        if (!secMap || (secMap.length > 0 && !secMap.includes(payload.role))) {
            consoleError(LOG, "unauthorized");
            let errMsg = new UnauthorizedMsg();
            errMsg.data.error = "unauthorized access.";
            return errMsg;
        }

        return null;
    }

}