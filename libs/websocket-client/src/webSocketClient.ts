/**
 * Defines the types of events that the WebSocketClient can emit.
 */
export type eventsTypes = "onopen" | "onerror" | "onclose" | "onmessage" | "networkchange";

/**
 * Prefix for log messages from this client.
 */
const logPre = "WebSocketClient";

/**
 * A robust WebSocket client that handles connections, automatic reconnections,
 * and sequential message processing. It provides an event-driven interface
 * for interacting with a WebSocket server.
 */
export class WebSocketClient {
    /** The underlying WebSocket instance. Null if not connected. */
    socket: WebSocket | null = null;
    /** A map to store event handler callbacks for different event types. */
    callbacks: Map<string, Function[]> = new Map();
    /** The current connection state of the WebSocket. */
    state: "" | "connecting" | "connected" | "disconnected" | "reconnecting" = "";
    /** Flag to determine if the client should attempt to reconnect automatically on close. */
    autoReconnect = false;
    /** Counter for reconnection attempts. */
    reconnectAttempts = 0;

    /**
     * Handles sequential processing of incoming WebSocket messages to ensure 
     * order and prevent race conditions between event listeners and waiters.
     */
    private messageQueue: Array<{ message: any; resolve: () => void }> = [];
    /** A lock to ensure that the message queue is processed by only one async task at a time. */
    private isProcessing: boolean = false;
    /** Flag to enable or disable logging. */
    private enableLogs = true;
    /** The URI of the WebSocket server. */
    private uri: string = "";
    /** The delay in seconds before attempting a reconnect. */
    private reconnectSecs: number = 5;

    /**
     * An array of "waiters," which are promises waiting for the next incoming message.
     * This allows for synchronous-style `await` calls to get the next message.
     */
    private busWaiters: Array<{
        resolve: (msg: any) => void;
        reject: (err: Error) => void;
        timeout: any;
    }> = [];

    /**
     * Initializes a new instance of the WebSocketClient.
     * @param args - Configuration options for the client.
     * @param args.enableLogs - Whether to enable console logging. Defaults to true.
     */
    constructor(args: { enableLogs: boolean } = { enableLogs: true }) {
        this.enableLogs = args.enableLogs;
        window.addEventListener('beforeunload', this.handleBeforeUnload.bind(this));
        window.addEventListener('online', this.handleNetworkChange.bind(this));
        window.addEventListener('offline', this.handleNetworkChange.bind(this));
    }

    /**
     * Asynchronously waits for the next message to be received by the WebSocket.
     * This is useful for implementing request-response patterns.
     * @param timeoutMs - The maximum time to wait in milliseconds before rejecting the promise.
     * @returns A promise that resolves with the next message received.
     */
    async waitFor(timeoutMs: number = 20000): Promise<any> {
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                // Remove this waiter if it times out
                this.busWaiters = this.busWaiters.filter(w => w.timeout !== timer);
                reject(new Error(`Timeout waiting for message after ${timeoutMs} ms`));
            }, timeoutMs);

            this.busWaiters.push({
                resolve,
                reject,
                timeout: timer
            });
        });
    }

    /**
     * Writes a log message to the console if logging is enabled.
     * @param params - The parameters to log.
     */
    writeLog(...params: any) {
        if (this.enableLogs) {
            console.log(logPre, ...params);
        }
    }

    /**
     * Connects to the WebSocket server at the specified URI.
     * @param uri - The WebSocket server URI (e.g., "wss://example.com").
     * @param autoReconnect - If true, the client will attempt to reconnect if the connection is lost.
     * @param reconnectSecs - The number of seconds to wait before attempting to reconnect.
     * @returns A promise that resolves when the connection attempt is initiated.
     */
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

        /**
         * Handles the 'open' event of the WebSocket. Sets the state to 'connected'
         * and fires the 'onopen' event handlers.
         */
        this.socket.onopen = async () => {
            this.writeLog("socket server connected");
            this.state = "connected";
            this.reconnectAttempts = 0;
            await this.fireEvent("onopen");
        };

        /**
         * Handles the 'error' event of the WebSocket. Logs the error and fires 'onerror' handlers.
         */
        this.socket.onerror = async (error) => {
            console.error("socket server error:", error);
            this.state = "disconnected";
            await this.fireEvent("onerror");
        };

        /**
         * Handles the 'close' event. Manages auto-reconnection logic or sets the state to 'disconnected'.
         */
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

        /**
         * Handles incoming messages. Parses the JSON data and enqueues it for processing.
         * @param event - The MessageEvent from the WebSocket.
         */
        this.socket.onmessage = async (event: MessageEvent) => {
            try {
                const message = JSON.parse(event.data);
                this.writeLog("event", message.type, message);
                await this.enqueueMessage(message);
            } catch (error) {
                console.error(logPre, "Error parsing message:", error);
            }
        };
    };

    /**
     * Ensures the WebSocket is closed gracefully when the page is about to be unloaded.
     */
    private handleBeforeUnload() {
        this.writeLog("Closing WebSocket on page unload");
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.writeLog("socket closed.");
        }
        this.fireEvent("onclose");
    }

    /**
     * Handles changes in the browser's network connection status (online/offline).
     */
    private handleNetworkChange() {
        this.writeLog(`Network change detected, online: ${navigator.onLine}`);
        this.fireEvent("networkchange");
    }

    /**
     * Adds a received message to a queue to be processed sequentially.
     * @param message - The message object to enqueue.
     */
    private async enqueueMessage(message: any): Promise<void> {
        const promise = new Promise<void>((resolve) => {
            this.messageQueue.push({ message, resolve });
        });

        if (!this.isProcessing) {
            this.processQueue();
        }

        return promise;
    }

    /**
     * Processes messages from the queue one by one. It first notifies any 'waiters'
     * and then dispatches the message to 'onmessage' event handlers. This ensures
     * orderly processing and prevents race conditions.
     */
    private async processQueue(): Promise<void> {
        if (this.isProcessing || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessing = true;

        while (this.messageQueue.length > 0) {
            const { message, resolve } = this.messageQueue.shift()!;

            try {
                // Notify all active waiters with the new message.
                for(var waiterIndex = 0; waiterIndex < this.busWaiters.length; waiterIndex++) {
                    const waiter = this.busWaiters[waiterIndex];
                    if (waiter.timeout) {
                        clearTimeout(waiter.timeout);
                    }                 
                    waiter.resolve(message);
                    this.busWaiters.splice(waiterIndex, 1);
                    waiterIndex--;
                }
                
                // Fire general 'onmessage' event handlers.
                if (this.callbacks.has("onmessage")) {
                    var data = JSON.stringify(message);
                    for (const cb of this.callbacks.get("onmessage")!.values()) {
                        await cb({ data });
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

    /**
     * Fires all registered callbacks for a given event type.
     * @param type - The type of event to fire.
     * @param data - Optional data to pass to the event handlers.
     */
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

    /**
     * Registers an event handler for a specific event type.
     * @param type - The event type to listen for.
     * @param callback - The function to call when the event occurs.
     * @returns True if the handler was added successfully, false otherwise.
     */
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

    /**
     * Removes a previously registered event handler.
     * @param type - The event type the handler was registered for.
     * @param callback - The specific callback function to remove.
     * @returns True if the handler was found and removed, false otherwise.
     */
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

    /**
     * Sends data to the WebSocket server.
     * @param data - The data to send. It will be stringified if it's an object.
     * @returns True if the data was sent successfully, false if the socket is not open.
     */
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

    /**
     * Disconnects the client, clears all event handlers, and stops any reconnection attempts.
     */
    disconnect() {
        this.writeLog("disconnect");
        this.autoReconnect = false;
        this.callbacks.clear();
        this.busWaiters = [];
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