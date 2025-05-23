
export type eventsTypes = "onopen" | "onerror" | "onclose" | "onmessage";

export class WebSocketClient {
    logPre = "WebSocketClient";
    socket: WebSocket = null;
    callbacks: Map<eventsTypes, Function[]> = new Map();
    state: "" | "connecting" | "connected" | "disconnected" | "reconnecting";
    autoReconnect = false;

    writeLog(...params: any) {
        console.log(this.logPre, ...params);
    }

    // Initialize WebSocket connection
    connect = async (uri: string, autoReconnect = false) => {
        this.writeLog(`connect ${uri} `);

        this.autoReconnect = autoReconnect;

        this.socket = new WebSocket(`${uri}`);
        this.state = "connecting";

        this.socket.onopen = () => {
            this.state = "connected";
            this.writeLog('socket server connected');
            this.fireEvent("onopen");
        };

        this.socket.onerror = (error) => {
            this.state = "disconnected";
            console.error('socket server error:', error);
            this.fireEvent("onerror");
        };

        this.socket.onclose = () => {
            this.writeLog("onclose");

            if (this.autoReconnect) {
                this.writeLog("reconnecautoReconnectting");

                this.state = "reconnecting";
                this.fireEvent("onclose");
                setTimeout(() => {
                    this.connect(uri, this.autoReconnect);
                }, 1000);
            } else {
                this.state = "disconnected";
                this.writeLog('socket server disconnected');
                this.fireEvent("onclose");
            }
        };

        // Handle incoming messages
        this.socket.onmessage = (event) => {
            this.fireEvent("onmessage", event);
        };
    }

    private fireEvent(type: eventsTypes, data?: any) {
        // Trigger registered callbacks for onmessage
        if (this.callbacks.has(type)) {
            this.callbacks.get(type).forEach((callback) => callback(data));
        }
    }

    // Register a callback for a specific message type (e.g., 'offer', 'answer', 'ice-candidate')
    addEventHandler(type: eventsTypes, callback: Function) {
        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
        }
        this.callbacks.get(type).push(callback);
    }

    //remove the event handler
    removeEventHandler(type: eventsTypes, callback: Function) {
        this.writeLog("removeEventHandler" + type);
        let cbarr = this.callbacks.get(type);
        if (cbarr) {
            let idx = cbarr.findIndex(cb => cb === callback);
            if (idx > -1) {
                cbarr.splice(idx, 1);
                this.writeLog("eventHandler removed" + type);
            }
        }
    }

    // Send a message to the signaling server
    send(data: any) {
        this.writeLog("send", data);
        try {
            if (this.socket.readyState === WebSocket.OPEN) {
                this.socket.send(data);
            } else {
                console.error("socket not connected.")
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Close the connection
    disconnect() {
        this.writeLog("disconnect");
        this.autoReconnect = false;
        this.callbacks.clear();
        this.state = "";
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.writeLog("socketed closed.");
        }
    }

}
