import express from 'express';
import { ConferenceServer } from './conferenceServer.js';
import { Participant, SocketConnection } from '../models/models.js';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';
import { IMsg } from '@rooms/rooms-models';
import { CallMessageType, RegisterResultMsg } from '@conf/conf-models';
import { consoleError, consoleLog, consoleWarn } from '../utils/utils.js';
import { ConferenceServerConfig, ConferenceServerEventTypes } from './models.js';

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
        this.printStats();

        this.wsServer = new WebSocketServer({ server: this.httpServer });
        this.wsServer.on('connection', (ws: WebSocket, req) => {

            consoleLog(LOG, `new socket connected, connections: ${this.connections.size}, participants: ` + this.confServer.participants.size);

            let newConnection = new SocketConnection(ws, this.config.conf_socket_timeout_secs);
            if (req.socket.remoteAddress) {
                newConnection.ips.push(req.socket.remoteAddress);
            }

            const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            if (ip) {
                newConnection.ips.push(ip);
            }
            consoleWarn(`socket ips:`, newConnection.ips);

            newConnection.addEventHandlers(this.onSocketTimeout.bind(this));
            this.connections.set(ws, newConnection);
            newConnection.restartSocketTimeout();

            this.startHeartbeat(ws, newConnection);

            ws.on("message", async (message) => {
                if (!message) {
                    return;
                }

                const msgIn = JSON.parse(message.toString()) as IMsg;
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
                        returnMsg = (await this.confServer.onRegister(msgIn) as RegisterResultMsg);
                        if (returnMsg.data.error) {
                            consoleError(LOG, `failed to register socket ${returnMsg.data.error}`);
                            return;
                        } else {
                            conn.participantId = returnMsg.data.participantId;
                            conn.username = returnMsg.data.username
                            consoleLog(LOG, `socket registered`, conn.participantId, conn.username);
                            conn.clearSocketTimeout();
                        }
                    }
                } else {
                    if (!conn.participantId) {
                        consoleError(LOG, `participantId is required when registering.`);
                        return;
                    }
                    returnMsg = await this.confServer.handleMsgInWS(conn.participantId, msgIn);
                }

                if (returnMsg) {
                    conn.ws.send(JSON.stringify(returnMsg));
                }

            });

            ws.on('pong', () => {
                const conn = this.connections.get(ws);
                if (conn) {
                    conn.lastPong = Date.now();
                    consoleLog(LOG, `Pong received for ${conn.username || 'unregistered'}`);
                }
            });

            ws.on("close", async () => {
                consoleLog(LOG, `socket closed`);
                this.cleanupSocket(ws);
            });

            ws.on("error", (event) => {
                consoleError(`socket error`, event);
                this.cleanupSocket(ws);
            });

        });
    }

    printStats() {
        consoleWarn(`#### Conference Socket Stats ####`);
        consoleWarn(`connections: `, this.connections.size);
        consoleWarn(`registered: `, [...this.connections.values()].filter(c => c.participantId).length);
        this.connections.forEach(c => consoleWarn(`username: ${c.username}:`, c.ips));
        consoleWarn(`#################################`);

        setTimeout(() => {
            this.printStats();
        }, 30000);
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

    startHeartbeat(ws: WebSocket, conn: SocketConnection) {
        conn.lastPong = Date.now();
        const heartbeatInterval = setInterval(() => {
            if (ws.readyState === WebSocket.CLOSED) {
                clearInterval(heartbeatInterval);
                this.cleanupSocket(ws);
                return;
            }

            if (Date.now() - conn.lastPong > this.config.conf_socket_pong_timeout_secs * 1000) {
                consoleWarn(LOG, `No pong received, closing connection`);
                this.cleanupSocket(ws);
                clearInterval(heartbeatInterval);
                return;
            }
            
            ws.ping();
        }, this.config.conf_socket_ping_interval_secs * 1000);
    }

    cleanupSocket(ws: WebSocket) {
        consoleLog(LOG, `cleanupSocket`);

        let conn = this.connections.get(ws);
        if (conn) {
            this.connections.delete(conn.ws);
            if (conn && conn.participantId) {
                this.confServer.terminateParticipant(conn.participantId);
                conn.dispose();
            }
        }
    }
}