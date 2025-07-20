import express from 'express';
import { ConferenceServer, ConferenceServerConfig } from './conferenceServer.js';
import { SocketConnection } from '../models/models.js';
import { WebSocketServer, WebSocket } from 'ws';
import https from 'https';

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

        this.confServer.onSendMsg = this.onSendMsg;
    }

    start() {
        console.log(`start ConferenceServer`);

        this.wsServer = new WebSocketServer({ server: this.httpServer });
        this.wsServer.on('connection', (ws: WebSocket) => {

            console.log("socket connected participants: " + this.confServer.participants.size);
            let newConnection = new SocketConnection(ws, this.config.conf_socket_timeout_secs);
            newConnection.onSocketTimeout = this.onSocketTimeout;
            this.connections.set(ws, newConnection);

            ws.onmessage = async (message) => {
                const msgIn = JSON.parse(message.data.toString());
                let conn = this.connections.get(ws);
                if (conn) {
                    this.confServer.handleMsgInWS(conn, msgIn);
                } else {
                    console.error(`connection not found.`);
                    this.connections.delete(ws);
                }
            };

            ws.onclose = async () => {
                console.log(`socket closed`)
                let conn = this.connections.get(ws);
                this.connections.delete(conn.ws);

                if (conn && conn.participant) {
                    this.confServer.terminateParticipant(conn.participant);
                }                
            }
            
        });
    }

    onSendMsg(conn: SocketConnection, msg: any) {
        console.log(`onSendMsg`, msg.type);

        try {
            conn.ws.send(JSON.stringify(msg));
        } catch (err) {
            console.error(err);
        }
    }

    onSocketTimeout(conn: SocketConnection) {
        console.log(`onSocketTimeout`);

        this.connections.delete(conn.ws);
        if (conn.participant) {
            this.confServer.terminateParticipant(conn.participant);
        }        
    }
}