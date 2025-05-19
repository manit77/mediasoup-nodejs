import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import {
    payloadTypeClient,
    payloadTypeServer,
    RegisterPeerMsg,
    TerminatePeerMsg,
    UnauthorizedMsg
} from '../models/roomSharedModels';
import { RoomServer, RoomServerConfig } from '../roomServer/roomServer';
import * as roomUtils from "../roomServer/utils";
import { AuthUserRoles } from '../models/tokenPayloads';

const DSTR = "RoomSocketServer";

export type RoomHTTPServerSecurityMap = {
    [key in payloadTypeClient | payloadTypeServer]: AuthUserRoles[];
};

export let defaultPeerSocketServerSecurityMap: RoomHTTPServerSecurityMap;
defaultPeerSocketServerSecurityMap[payloadTypeClient.registerPeer] = [];
defaultPeerSocketServerSecurityMap[payloadTypeClient.connectConsumerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.connectProducerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.consume] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.createConsumerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.createProducerTransport] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.produce] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomJoin] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomLeave] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomNew] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomNewToken] = [AuthUserRoles.user];
defaultPeerSocketServerSecurityMap[payloadTypeClient.roomTerminate] = [AuthUserRoles.user];

export class RoomPeerSocketServer {

    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private config: RoomServerConfig, private securityMap: RoomHTTPServerSecurityMap, private httpServer: https.Server, private roomServer: RoomServer) {
        roomServer.addEventListner((peerId: string, msg: any) => {
            let socket = this.peers.get(peerId);
            if (socket) {

                if (msg.type == payloadTypeClient.terminatePeer) {
                    console.log("socket closed");
                    socket.close();
                    return;
                }
                this.send(socket, msg);

            } else {
                console.log(DSTR, "peer not found for message: " + msg.type);
            }
        });

        this.initWebSocket();
    }

    private async initWebSocket() {

        console.log(DSTR, "initWebSocket");

        this.webSocketServer = new WebSocketServer({ server: this.httpServer });
        this.webSocketServer.on('connection', (ws) => {

            console.log(DSTR, "socket connected peers: " + this.peers.size);

            ws.on('message', async (message) => {
                try {

                    console.log(DSTR, "msgIn, ", message.toString());
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
                            console.log(DSTR, "socket registered:" + registerResult.data.peerId);
                        } else {
                            console.error(DSTR, "register failed, no peerid for socket.");
                        }
                    } else {
                        let peerid = this.findPeerBySocket(ws);
                        if (peerid) {
                            //inject the authtoken from the socket
                            let authToken = ws["room_authtoken"];

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
                            if (!secMap || secMap != payload.role) {
                                console.error("unauthorized");
                                let errMsg = new UnauthorizedMsg();
                                errMsg.data.error = "unauthorized access.";
                                return errMsg;
                            }

                            msgIn.data.authToken = authToken;
                            this.roomServer.inMessage(peerid, msgIn);

                        } else {
                            console.log(DSTR, `${msgIn.type} peer not found by socket`);
                            console.log(DSTR, this.peers);
                        }
                    }
                } catch (err) {
                    console.error(err);
                    console.log(message);
                }

            });

            ws.on('close', () => {
                //when the socket closes terminate the peers transports 
                let peerid = this.findPeerBySocket(ws);
                if (peerid) {
                    let msg = new TerminatePeerMsg();
                    msg.data.peerId = peerid;
                    this.roomServer.onTerminatePeer(msg);
                }
            });
        });
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
        console.log(DSTR, 'send ', msg);
        ws.send(JSON.stringify(msg));
    }

}