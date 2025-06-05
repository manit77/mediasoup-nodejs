
type eventsTypes = "onopen" | "onerror" | "onclose" | "onmessage";

export class WebSocketManager {
    socket: WebSocket = null;
    callbacks: Map<eventsTypes, Function[]> = new Map();
    isConnected = false;
    autoReconnect = false;
    token : string;
    // Initialize WebSocket connection
    initialize = async (uri: string, token: string, autoReconnect = false) => {
        this.autoReconnect = autoReconnect;
        this.token = token;

        this.socket = new WebSocket(`${uri}?token=${token}`);

        this.socket.onopen = () => {
            this.isConnected = true;
            console.log('Signaling server connected');
            this.fireEvent("onopen");
        };

        this.socket.onerror = (error) => {
            console.error('Signaling server error:', error);
            this.isConnected = false;
            this.fireEvent("onerror");
        };

        this.socket.onclose = () => {
            this.isConnected = false;
            console.log('Signaling server disconnected');
            this.fireEvent("onclose");

            if (autoReconnect) {
                setTimeout(() => {
                    this.initialize(uri, token, autoReconnect);
                }, 1000);
            }
        };

        // Handle incoming messages
        this.socket.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.fireEvent("onmessage", message);
        };
    }

    fireEvent(type: eventsTypes, data?: any) {
        // Trigger registered callbacks for onmessage
        if (this.callbacks.has(type)) {
            this.callbacks.get(type).forEach((callback) => callback(data));
        }
    }

    // Register a callback for a specific message type (e.g., 'offer', 'answer', 'ice-candidate')
    on(type: eventsTypes, callback: Function) {
        if (!this.callbacks.has(type)) {
            this.callbacks.set(type, []);
        }
        this.callbacks.get(type).push(callback);

        // Return a function to remove the callback
        return () => {
            let cbarr = this.callbacks.get(type);
            let idx = cbarr.findIndex(cb => cb === callback);
            if (idx > -1) {
                cbarr.splice(idx, 1);
            }
        };
    }

    // Send a message to the signaling server
    send(data: any) {
        if (!this.isConnected || !this.socket) {
            throw new Error('Signaling server not connected');
        }
        this.socket.send(JSON.stringify(data));
    }

    // Close the connection
    disconnect() {
        this.autoReconnect = false;
        this.callbacks.clear();
        if (this.socket) {
            this.socket.close();
            this.socket = null;
            this.isConnected = false;            
        }
    }

}
