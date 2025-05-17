import https from 'https';
import { WebSocket, WebSocketServer } from 'ws';
import {
    payloadTypeClient,
    payloadTypeServer,
    RegisterMsg,
    RegisterResultMsg,
    TerminatePeerMsg
} from '../models/roomSharedModels';
import { RoomServer } from '../roomServer/roomServer';

const DSTR = "RoomSocketServer";

export class RoomSocketServer {

    webSocketServer: WebSocketServer;
    peers = new Map<string, WebSocket>();

    constructor(private httpServer: https.Server, private roomServer: RoomServer) {
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

                    if (msgIn.type == payloadTypeClient.register) {
                        //we need to tie the peerid to the socket
                        let registerResult = this.roomServer.onRegister("", msgIn);
                        if (registerResult.data.peerId) {
                            //store the authtoken in the socket
                            ws["room_authtoken"] = (msgIn as RegisterMsg)?.data?.authToken;
                            this.peers.set(registerResult.data.peerId, ws);
                            this.send(ws, registerResult);
                            console.error(DSTR, "socket registered:" + registerResult.data.peerId);

                        } else {
                            console.error(DSTR, "register failed, no peerid for socket.");
                        }
                    } else {
                        let peerid = this.findPeerBySocket(ws);
                        if (peerid) {
                            //inject the authtoken from the socket
                            msgIn.data.authToken = ws["room_authtoken"];
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