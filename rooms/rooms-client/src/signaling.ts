import { IMsg, OkMsg, payloadTypeServer } from "@rooms/rooms-models";
import { WebSocketClient } from "@rooms/websocket-client";

export class Signaling {
  private ws: WebSocketClient;
  private messageListener: Array<((msg: IMsg) => void)> = [];

  config = {
    socket_ws_uri: "wss://localhost:3000",
    socket_auto_reconnect: true,
    socket_enable_logs: false
  }

  constructor(options: { socket_ws_uri: string, socket_auto_reconnect: boolean, socket_enable_logs: boolean }) {
    this.config = { ...this.config, ...options };
    this.ws = new WebSocketClient({ enableLogs: this.config.socket_enable_logs });
  }

  public addOnMessageListener(cb: (msg: IMsg) => void) {
    this.ws.addEventHandler("onmessage", (event: any) => {
      const msgIn = JSON.parse(event.data);
      cb(msgIn);
    });
  }

  public addOnCloseListener(cb: () => void) {
    this.ws.addEventHandler("onclose", cb);
  }

  public addOnErrorListener(cb: (err: any) => void) {
    this.ws.addEventHandler("onerror", cb);
  }

  public connect = async (wsURI: string = ""): Promise<void> => {
    console.log(`connect ${wsURI} autoReconnect: ${this.config.socket_auto_reconnect}`);
    if (wsURI) {
      this.config.socket_ws_uri = wsURI;
    }

    if (this.ws && ["connecting", "connected"].includes(this.ws.state)) {
      console.log("socket already " + this.ws.state)
      return;
    }

    this.ws.connect(this.config.socket_ws_uri, this.config.socket_auto_reconnect);
  };

  public disconnect = () => {
    if (this.ws) {
      this.ws.disconnect();
    }
  }

  public send = (msg: any): boolean => {
    console.log("send", msg.type, msg);
    return this.ws.send(JSON.stringify(msg));
  };

  public waitForOpen = (timeoutSecs: number = 30): Promise<IMsg> => {
    return new Promise<IMsg>((resolve, reject) => {
      if (this.ws.state === "connected") {
        return resolve(new OkMsg(payloadTypeServer.ok, "already connected"));
      }

      let timerId: any;

      const _onOpen = () => {
        cleanup();
        resolve(new OkMsg(payloadTypeServer.ok, "socket opened."));
      };

      const _onError = (err: any) => {
        cleanup();
        console.error("WebSocket connection error:", err);
        reject(new Error("WebSocket connection failed."));
      };

      const cleanup = () => {
        clearTimeout(timerId);
        this.ws.removeEventHandler("onopen", _onOpen);
        this.ws.removeEventHandler("onerror", _onError);
      };

      timerId = setTimeout(() => {
        cleanup();
        if (this.ws) {
          this.ws.disconnect();
        }
        reject(new Error(`Connection timed out after ${timeoutSecs} seconds.`));
      }, timeoutSecs * 1000);

      this.ws.addEventHandler("onopen", _onOpen);
      this.ws.addEventHandler("onerror", _onError);

      this.connect();
    });
  }

  public async waitForResponse(messageType: string, timeoutMs: number): Promise<IMsg> {
    // This relies on an external message pump calling onSocketEvent
    // A more robust implementation might use an internal event emitter.
    while (true) {
      const msg = await this.ws.waitFor(timeoutMs);
      if (msg.type === messageType) {
        return msg;
      }
      // In a real scenario, you'd want to handle or buffer other messages.
      console.log(`waitForResponse: ignoring message of type ${msg.type}`);
    }
  }
}