import { consoleLog, consoleWarn } from "#conf-server/utils/utils.js";
import { WebSocket } from 'ws';

type onSocketTimeout = (conn: SocketConnection) => void;

export class SocketConnection {

    ws: WebSocket;

    /**
     * time allowed until registration
     */
    timeoutSecs: number;
    socketTimeoutId: any;

    participantId: string;
    username: string;
    eventHandlers: onSocketTimeout[] = [];
    dateOfLastMsg: Date = new Date();
    dateCreated = new Date();

    pingInterval: any;
    lastPong: number;
    ips: string[] = [];

    constructor(webSocket: WebSocket, socketTimeoutSecs: number) {
        this.ws = webSocket;
        this.timeoutSecs = socketTimeoutSecs;
    }

    dispose() {
        consoleLog(`SocketConnection dispose()`);
        this.eventHandlers = [];

        if (this.ws) {
            this.ws.close();
            this.ws = null;
            consoleLog(`SocketConnection ws close`);
        }
    }

    addEventHandlers(cb: onSocketTimeout) {
        this.eventHandlers.push(cb);
    }

    clearSocketTimeout = () => {
        consoleLog(`clearSocketTimeout`);

        if (this.socketTimeoutId) {
            clearTimeout(this.socketTimeoutId);
            this.socketTimeoutId = null;
        }
    };

    restartSocketTimeout = () => {
        consoleLog(`restartSocketTimeout`);

        if (this.socketTimeoutId) {
            clearTimeout(this.socketTimeoutId);
            this.socketTimeoutId = null;
        }

        if (this.timeoutSecs <= 0) {
            consoleWarn(`not timeout set for this connection.`);
            return;
        }

        consoleLog(`SocketConnection socketTimeout started:`, this.timeoutSecs);
        consoleWarn(`Socket has ${this.timeoutSecs} to register.`);
        this.socketTimeoutId = setTimeout(() => {
            consoleLog(`SocketConnection socketTimeout reached ${this.eventHandlers.length}`);
            for (let cb of this.eventHandlers) {
                consoleWarn(`SocketConnection socketTimeout fire event`);
                cb(this);
            }
        }, this.timeoutSecs * 1000);
    };

}