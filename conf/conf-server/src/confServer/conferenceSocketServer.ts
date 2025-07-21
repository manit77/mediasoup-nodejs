import express from 'express';
import { ConferenceServer, ConferenceServerConfig, ConferenceServerEventTypes } from './conferenceServer.js';
import { Participant, SocketConnection } from '../models/models.js';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';
import { IMsg } from '@rooms/rooms-models';
import { CallMessageType, RegisterResultMsg } from '@conf/conf-models';

export class ConferenceSocketServer {
    wsServer: WebSocketServer;
    connections = new Map<WebSocket, SocketConnection>();
    private app: express.Express;
    private httpServer: https.Server;
    private config: ConferenceServerConfig;
    private confServer: ConferenceServer;

    constructor(args: { app: express.Express, httpServer: https.Server, config: ConferenceServerConfig, confServer: ConferenceServer }) {
        this.app = args.app;
        this.confServer = args.confServer;
        this.config = args.config;
        this.httpServer = args.httpServer;
        this.confServer.addEventHandler(ConferenceServerEventTypes.onSendMsg, this.onSendMsg.bind(this));
    }

    start() {
        console.log(`start ConferenceServer`);

        this.wsServer = new WebSocketServer({ server: this.httpServer });
        this.wsServer.on('connection', (ws: WebSocket) => {

            console.log("new socket connected, current participants: " + this.confServer.participants.size);
            let newConnection = new SocketConnection(ws, this.config.conf_socket_timeout_secs);
            newConnection.addEventHandlers(this.onSocketTimeout.bind(this));
            this.connections.set(ws, newConnection);
            newConnection.restartSocketTimeout();

            ws.onmessage = async (message) => {
                const msgIn = JSON.parse(message.data.toString()) as IMsg;
                let conn = this.connections.get(ws);
                if (!conn) {
                    console.error(`connection not found.`);
                    this.connections.delete(ws);
                    return;
                }

                if (!msgIn.type) {
                    console.error("message has no type");
                    return;
                }

                if (msgIn.type == CallMessageType.register) {
                    //register belongs to the a socket connection
                    if (conn.participantId) {
                        console.error(`already registered`, conn.participantId);
                    } else {
                        let result = await this.confServer.onRegister(msgIn) as RegisterResultMsg;
                        if (result.data.error) {
                            console.error(`failed to register socket`);
                            return;
                        }
                        conn.participantId = result.data.participantId
                        console.log(`socket registered`, conn.participantId);
                        conn.restartSocketTimeout();
                        return;
                    }
                } else {
                    let msg: IMsg = await this.confServer.handleMsgInWS(conn.participantId, msgIn);
                    if (msg) {
                        if (!msg.data.error) {
                            conn.restartSocketTimeout();
                        }
                        conn.ws.send(JSON.stringify(msg));
                    }
                }

            };

            ws.onclose = async () => {
                console.log(`socket closed`);
                let conn = this.connections.get(ws);
                if (conn) {
                    this.connections.delete(conn.ws);
                    if (conn && conn.participantId) {
                        this.confServer.terminateParticipant(conn.participantId);                        
                        conn.dispose();
                    }
                }
            }
        });
    }

    onSendMsg(participant: Participant, msg: IMsg) {
        console.log(`onSendMsg`, msg.type);
        try {
            let conn = [...this.connections.values()].find(c => c.participantId === participant.participantId);
            if (conn) {
                conn.ws.send(JSON.stringify(msg));
            }
        } catch (err) {
            console.error(err);
        }
    }

    onSocketTimeout(conn: SocketConnection) {
        console.log(`onSocketTimeout`);
        if(conn.participantId) {
            this.confServer.terminateParticipant(conn.participantId);
        }
        this.connections.delete(conn.ws);
        conn.dispose();
        
    }
}