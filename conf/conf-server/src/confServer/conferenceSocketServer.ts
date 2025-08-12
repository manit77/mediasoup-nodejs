import express from 'express';
import { ConferenceServer } from './conferenceServer.js';
import { Participant, SocketConnection } from '../models/models.js';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';
import { IMsg, UnauthorizedMsg } from '@rooms/rooms-models';
import {
    CallMessageType,
    // NotRegisteredMsg, 
    RegisterResultMsg
} from '@conf/conf-models';
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

    send(ws: WebSocket, msg: any) {
        if(!ws){
            consoleError(`cannot send msg, socket is null`);
            return;
        }
        try {
            ws.send(JSON.stringify(msg));
            return true;
        } catch (err) {
            consoleError(err);
        }
        return false;
    }

    start() {
        consoleLog(LOG, `start ConferenceSocketServer`);
        this.printStats();

        this.wsServer = new WebSocketServer({ server: this.httpServer });
        this.wsServer.on('connection', (ws: WebSocket, req) => {

            consoleLog(LOG, `new socket connected, connections: ${this.connections.size}, participants: ` + this.confServer.participants.size);

            //log remote ip addresses
            let newConnection = new SocketConnection(ws, this.config.conf_socket_timeout_secs);
            if (req.socket.remoteAddress) {
                newConnection.ips.push(req.socket.remoteAddress);
            }

            const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim()
            if (ip) {
                newConnection.ips.push(ip);
            }
            consoleWarn(`socket ips:`, newConnection.ips);

            //start registration timeout
            newConnection.addEventHandlers(() => this.onSocketTimeout(newConnection));
            this.connections.set(ws, newConnection);
            newConnection.restartSocketTimeout();

            //start ping timeout
            this.startPingTimeOut(ws, newConnection);

            ws.on("message", async (message) => {
                if (!message) {
                    return;
                }

                let msgIn: IMsg;

                try {
                    msgIn = JSON.parse(message.toString()) as IMsg;
                } catch (err) {
                    //not a a json string
                    consoleError(err, message);
                    consoleError(message.toString());
                    return;
                }

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
                        consoleError(LOG, `connection is not registered.`, msgIn);
                        //send back unauthorized
                        let msg = new UnauthorizedMsg();
                        this.send(conn.ws, msg);

                        // let msgNotRegistered = new NotRegisteredMsg();
                        // conn.ws.send(JSON.stringify(msgNotRegistered));
                        return;
                    }
                    returnMsg = await this.confServer.handleMsgInWS(conn.participantId, msgIn);
                }

                if (returnMsg) {
                    this.send(conn.ws, returnMsg);
                }

            });

            ws.on('pong', () => {
                const conn = this.connections.get(ws);
                if (conn) {
                    conn.lastPong = Date.now();
                    consoleWarn(LOG, `Pong received for ${conn.username || 'unregistered'}`, Date.now());
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
                this.send(conn.ws, msg);
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

    /**
     * start ping pong timeout check for stale connections
     * conf_socket_pong_timeout_secs must be larger than the conf_socket_ping_interval_secs
     * @param ws 
     * @param conn 
     */
    startPingTimeOut(ws: WebSocket, conn: SocketConnection) {

        if (this.config.conf_socket_pong_timeout_secs <= this.config.conf_socket_ping_interval_secs) {
            consoleError(`error conf_socket_pong_timeout_secs must be > than conf_socket_ping_interval_secs`);
        }

        conn.pingInterval = setInterval(() => {
            if (ws.readyState !== WebSocket.OPEN) {
                clearInterval(conn.pingInterval);
                this.cleanupSocket(ws);
                return;
            }

            const timeSincePong = Date.now() - conn.lastPong;
            consoleWarn(LOG, timeSincePong, this.config.conf_socket_pong_timeout_secs * 1000);

            if (timeSincePong >= this.config.conf_socket_pong_timeout_secs * 1000) {
                consoleError(LOG, `No pong received, closing connection`);
                clearInterval(conn.pingInterval);
                this.cleanupSocket(ws);
                return;
            }

            try {
                ws.ping();
                consoleWarn(`ping sent`);
            } catch (err) {
                consoleError(LOG, 'Ping error', err);
                clearInterval(conn.pingInterval);
                this.cleanupSocket(ws);
            }
        }, this.config.conf_socket_ping_interval_secs * 1000);


        try {
            ws.ping();
            consoleWarn(`ping sent`);
        } catch (err) {
            consoleError(LOG, 'Ping error', err);
            clearInterval(conn.pingInterval);
            this.cleanupSocket(ws);
        }
    }


    cleanupSocket(ws: WebSocket) {
        consoleLog(LOG, `cleanupSocket`);

        let conn = this.connections.get(ws);
        if (conn) {
            clearInterval(conn.pingInterval);
            this.connections.delete(conn.ws);
            if (conn && conn.participantId) {
                this.confServer.terminateParticipant(conn.participantId);
                conn.dispose();
            }
        }
    }
}