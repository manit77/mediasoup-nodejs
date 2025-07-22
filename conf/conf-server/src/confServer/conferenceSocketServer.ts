import express from 'express';
import { ConferenceServer, ConferenceServerConfig, ConferenceServerEventTypes } from './conferenceServer.js';
import { Participant, SocketConnection } from '../models/models.js';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';
import { IMsg } from '@rooms/rooms-models';
import { CallMessageType, RegisterResultMsg } from '@conf/conf-models';
import { consoleError, consoleLog } from '../utils/utils.js';

const LOG = "ConferenceSocketServer";

export class ConferenceSocketServer {
    wsServer: WebSocketServer;
    connections = new Map<WebSocket, SocketConnection>();
    private httpServer: https.Server;
    private config: ConferenceServerConfig;
    private confServer: ConferenceServer;

    constructor(args: { httpServer: https.Server, config: ConferenceServerConfig, confServer: ConferenceServer }) {
        this.confServer = args.confServer;
        this.config = args.config;
        this.httpServer = args.httpServer;
        this.confServer.addEventHandler(ConferenceServerEventTypes.onSendMsg, this.onSendMsg.bind(this));
    }

    start() {
        consoleLog(LOG, `start ConferenceSocketServer`);

        this.wsServer = new WebSocketServer({ server: this.httpServer });
        this.wsServer.on('connection', (ws: WebSocket) => {

            consoleLog(LOG, `new socket connected, connections: ${this.connections.size}, participants: ` + this.confServer.participants.size);
            let newConnection = new SocketConnection(ws, this.config.conf_socket_timeout_secs);
            newConnection.addEventHandlers(this.onSocketTimeout.bind(this));
            this.connections.set(ws, newConnection);
            newConnection.restartSocketTimeout();

            ws.onmessage = async (message) => {
                const msgIn = JSON.parse(message.data.toString()) as IMsg;
                let conn = this.connections.get(ws);
                if (!conn) {
                    consoleError(LOG, `connection not found.`);
                    this.connections.delete(ws);
                    return;
                }

                if (!msgIn.type) {
                    consoleError(LOG, "message has no type");
                    return;
                }

                let returnMsg: IMsg;

                if (msgIn.type == CallMessageType.register) {
                    //register belongs to the a socket connection
                    if (conn.participantId) {
                        consoleError(LOG, `already registered`, conn.participantId);
                        returnMsg = new RegisterResultMsg();
                        returnMsg.data.error = "already registered.";

                    } else {
                        returnMsg = await this.confServer.onRegister(msgIn) as RegisterResultMsg;
                        if (returnMsg.data.error) {
                            consoleError(LOG, `failed to register socket ${returnMsg.data.error}`);
                            return;
                        } else {
                            conn.participantId = returnMsg.data.participantId
                            consoleLog(LOG, `socket registered`, conn.participantId);
                            conn.restartSocketTimeout();
                        }
                    }
                } else {
                    if (!conn.participantId) {
                        consoleError(LOG, `participantId is required.`);
                        return;
                    }
                    returnMsg = await this.confServer.handleMsgInWS(conn.participantId, msgIn);
                }

                if (returnMsg) {
                    if (!returnMsg.data.error) {
                        conn.restartSocketTimeout();
                    }
                    conn.ws.send(JSON.stringify(returnMsg));
                }

            };

            ws.onclose = async () => {
                consoleLog(LOG, `socket closed`);
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
        consoleLog(LOG, `onSendMsg`, msg.type);
        try {
            let conn = [...this.connections.values()].find(c => c.participantId === participant.participantId);
            if (conn) {
                conn.ws.send(JSON.stringify(msg));
            }
        } catch (err) {
            consoleError(LOG, err);
        }
    }

    onSocketTimeout(conn: SocketConnection) {
        consoleLog(LOG, `onSocketTimeout`);
        if (conn.participantId) {
            this.confServer.terminateParticipant(conn.participantId);
        }
        this.connections.delete(conn.ws);
        conn.dispose();
    }
}