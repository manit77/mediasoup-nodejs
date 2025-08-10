export type eventsTypes = "onopen" | "onerror" | "onclose" | "onmessage" | "networkchange";

export enum CallMessageType {
    registerResult = "registerResult",
    getContactsResult = "getContactsResult",
    invite = "invite",
    reject = "reject",
    inviteResult = "inviteResult",
    inviteCancelled = "inviteCancelled",
    createConfResult = "createConfResult",
    joinConfResult = "joinConfResult",
    conferenceReady = "conferenceReady",
}

interface CallMessage {
    type: CallMessageType;
    [key: string]: any;
}

const logPre = "WebSocketClient";

export class WebSocketClient {
    socket: WebSocket | null = null;
    callbacks: Map<eventsTypes, Function[]> = new Map();
    state: "" | "connecting" | "connected" | "disconnected" | "reconnecting" = "";
    autoReconnect = false;
    reconnectAttempts = 0;
    private messageQueue: Array<{ message: CallMessage; resolve: () => void }> = [];
    private isProcessing: boolean = false;
    private enableLogs = true;
    private uri: string = "";
    private reconnectSecs: number = 5;

    constructor(args: { enableLogs: boolean } = { enableLogs: true }) {
        this.enableLogs = args.enableLogs;
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        // Add network change handlers
        window.addEventListener('online', this.handleNetworkChange.bind(this));
        window.addEventListener('offline', this.handleNetworkChange.bind(this));
    }

    writeLog(...params: any) {
        if (this.enableLogs) {
            console.log(logPre, ...params);
        }
    }

    connect = async (uri: string, autoReconnect = false, reconnectSecs: number = 5) => {
        this.writeLog(`connect ${uri}`);
        this.uri = uri;
        this.autoReconnect = autoReconnect;
        this.reconnectSecs = reconnectSecs;

        if (this.socket) {
            this.writeLog("Closing existing socket before connecting");
            this.disconnect();
        }

        this.socket = new WebSocket(uri);
        this.state = "connecting";

        this.socket.onopen = async () => {
            this.writeLog("socket server connected");
            this.state = "connected";
            this.reconnectAttempts = 0;
            await this.fireEvent("onopen");
        };

        this.socket.onerror = async (error) => {
            console.error("socket server error:", error);
            this.state = "disconnected";
            await this.fireEvent("onerror");
        };

        this.socket.onclose = async () => {
            this.writeLog("onclose");
            if (this.autoReconnect) {
                this.writeLog("Attempting to reconnect...");
                this.state = "reconnecting";
                await this.fireEvent("onclose");
                setTimeout(() => {
                    this.reconnectAttempts++;
                    this.socket = null;
                    this.connect(this.uri, this.autoReconnect, this.reconnectSecs);
                }, this.reconnectSecs * 1000);
            } else {
                this.state = "disconnected";
                this.writeLog("socket server disconnected");
                await this.fireEvent("onclose");
            }
        };

        this.socket.onmessage = async (event: MessageEvent) => {
            try {
                const message: CallMessage = JSON.parse(event.data);
                this.writeLog("event", message.type, message);
                await this.enqueueMessage(message);
            } catch (error) {
                console.error(logPre, "Error parsing message:", error);
            }
        };
    };

    private handleBeforeUnload() {
        this.writeLog("Closing WebSocket on page unload");
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.writeLog("socket closed.");
        }
        this.fireEvent("onclose");
    }

    private handleNetworkChange() {
        this.writeLog(`Network change detected, online: ${navigator.onLine}`);
        this.fireEvent("networkchange");
    }

    private async enqueueMessage(message: CallMessage): Promise<void> {
        const promise = new Promise<void>((resolve) => {
            this.messageQueue.push({ message, resolve });
        });

        if (!this.isProcessing) {
            this.processQueue();
        }

        return promise;
    }

    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.messageQueue.length > 0) {
            const { message, resolve } = this.messageQueue.shift()!;

            try {
                if (this.callbacks.has("onmessage")) {
                    for (const cb of this.callbacks.get("onmessage")!.values()) {
                        await cb({ data: JSON.stringify(message) });
                    }
                }
            } catch (error) {
                console.error(logPre, `Error processing message ${message.type}:`, error);
            } finally {
                resolve();
            }
        }

        this.isProcessing = false;
    }

    private async fireEvent(type: eventsTypes, data?: any) {
        if (type === "onmessage") {
            return;
        }

        if (this.callbacks.has(type)) {
            for (const cb of this.callbacks.get(type)!.values()) {
                await cb(data);
            }
        }
    }

    addEventHandler(type: eventsTypes, callback: Function) {
        this.writeLog(`addEventHandler for ${type}`);
        if (!callback) {
            this.writeLog("ERROR: callback is null");
            return false;
        }

        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
        }
        let arrCallBacks = this.callbacks.get(type)!;
        if (!arrCallBacks.includes(callback)) {
            arrCallBacks.push(callback);
            this.writeLog(`Added event handler for ${type}`);
        } else {
            this.writeLog(`event handler already exists ${type}`);
        }
        return true;
    }

    removeEventHandler(type: eventsTypes, callback: Function): boolean {
        this.writeLog(`removeEventHandler ${type}`);
        const cbarr = this.callbacks.get(type);
        if (cbarr) {
            const idx = cbarr.findIndex((cb) => cb === callback);
            if (idx > -1) {
                cbarr.splice(idx, 1);
                this.writeLog(`eventHandler removed ${type}`);
                return true;
            }
        }
        return false;
    }

    send(data: any): boolean {
        this.writeLog("send", data);
        try {
            if (this.socket && this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(data);
                return true;
            } else {
                console.error("socket not connected.");
            }
        } catch (err) {
            console.error(err);
        }
        return false;
    }

    disconnect() {
        this.writeLog("disconnect");
        this.autoReconnect = false;
        this.callbacks.clear();
        this.messageQueue = [];
        this.isProcessing = false;
        this.state = "";
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.writeLog("socket closed.");
        }
    }
}