export type eventsTypes = "onopen" | "onerror" | "onclose" | "onmessage";

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
    private messageQueue: Array<{ message: CallMessage; resolve: () => void }> = [];
    private isProcessing: boolean = false;
    private enableLogs = true;

    constructor(args: { enableLogs: boolean } = { enableLogs: true }) {
        this.enableLogs = args.enableLogs;
    }

    writeLog(...params: any) {
        if (this.enableLogs) {
            console.log(logPre, ...params);
        }
    }

    // Initialize WebSocket connection
    connect = async (uri: string, autoReconnect = false, reconnectSecs: number = 5) => {
        this.writeLog(`connect ${uri}`);

        if (this.socket) {
            this.writeLog("socket already created.");
            return;
        }

        this.autoReconnect = autoReconnect;
        this.socket = new WebSocket(`${uri}`);
        this.state = "connecting";

        this.socket.onopen = async () => {
            this.writeLog("socket server connected");

            this.state = "connected";
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
                    this.socket = null; // Reset socket
                    this.connect(uri, this.autoReconnect);
                }, reconnectSecs * 1000);
            } else {
                this.state = "disconnected";
                this.writeLog("socket server disconnected");
                await this.fireEvent("onclose");
            }
        };

        // Handle incoming messages
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
                // Fire onmessage callbacks sequentially
                if (this.callbacks.has("onmessage")) {
                    for (const cb of this.callbacks.get("onmessage")!.values()) {
                        await cb({ data: JSON.stringify(message) }); // Mimic MessageEvent
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
            // onmessage events are handled via the queue
            return;
        }

        if (this.callbacks.has(type)) {
            for (const cb of this.callbacks.get(type)!.values()) {
                await cb(data);
            }
        }
    }

    // Register a callback for a specific message type
    addEventHandler(type: eventsTypes, callback: Function) {
        this.writeLog(`addEventHandler for ${type}`);

        if (!callback) {
            this.writeLog("ERROR: call is null");
            return false;
        }

        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
        }
        let arrCallBacks = this.callbacks.get(type);
        if (!arrCallBacks.includes(callback)) {
            this.callbacks.get(type)!.push(callback);
            this.writeLog(`Added event handler for ${type}`);
        } else {
            this.writeLog(`event handler already exists ${type}`);
        }
    }

    // Remove the event handler
    removeEventHandler(type: eventsTypes, callback: Function): boolean {
        this.writeLog(`removeEventHandler ${type}`);

        const cbarr = this.callbacks.get(type);
        if (cbarr) {
            const idx = cbarr.findIndex((cb) => cb === callback);
            if (idx > -1) {
                cbarr.splice(idx, 1);
                this.writeLog(`eventHandler removed ${type}`);
                console.log(logPre, `eventHandler removed ${type}`);
                return true;
            }
        }
        return false;
    }

    // Send a message to the signaling server
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

    // Close the connection
    disconnect() {
        this.writeLog("disconnect");

        this.autoReconnect = false;
        this.callbacks.clear();
        this.messageQueue = []; // Clear the queue
        this.isProcessing = false;
        this.state = "";
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.writeLog("socket closed.");
        }
    }
}