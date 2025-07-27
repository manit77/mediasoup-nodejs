/**
 * server receives these payload types
 */
export enum payloadTypeClient {
    authUserNewToken = "authUserNewToken",

    registerPeer = "registerPeer",
    terminatePeer = "terminatePeer",

    createProducerTransport = "createProducerTransport",
    createConsumerTransport = "createConsumerTransport",
    connectProducerTransport = "connectProducerTransport",
    connectConsumerTransport = "connectConsumerTransport",

    roomNewToken = "roomNewToken",
    roomNewTokenResult = "roomNewTokenResult",
    roomNew = "roomNew",
    roomJoin = "roomJoin",
    roomLeave = "roomLeave",
    roomTerminate = "roomTerminate",
    roomGetLogs = "roomGetLogs",

    roomProduceStream = "roomProduceStream",
    roomCloseProducer = "roomCloseProducer",
    roomConsumeStream = "roomConsumeStream",

    peerTracksInfo = "peerTracksInfo",
    peerMuteTracks = "peerMuteTracks",
}


/**
 * server sends these payload types
 */
export enum payloadTypeServer {

    authUserNewTokenResult = "authUserNewTokenResult",
    registerPeerResult = "registerPeerResult",

    producerTransportCreated = "producerTransportCreated",
    consumerTransportCreated = "consumerTransportCreated",
    producerTransportConnected = "producerTransportConnected",
    consumerTransportConnected = "consumerTransportConnected",
    createProducerTransportResult = "createProducerTransportResult",
    createConsumerTransportResult = "createConsumerTransportResult",
    connectProducerTransportResult = "connectProducerTransportResult",
    connectConsumerTransportResult = "connectConsumerTransportResult",

    roomProduceStreamResult = "roomProduceStreamResult",
    roomConsumeStreamResult = "roomConsumeStreamResult",
    roomConsumerClosed = "roomConsumerClosed",

    roomNewResult = "roomNewResult",
    roomNewTokenResult = "roomNewTokenResult",
    roomJoinResult = "roomJoinResult",
    roomLeaveResult = "roomLeaveResult",
    roomNewPeer = "roomNewPeer",
    roomNewProducer = "roomNewProducer",
    roomPeerLeft = "roomPeerLeft",
    roomTerminateResult = "roomTerminateResult",
    roomClosed = "roomClosed",
    roomGetLogsResult = "roomGetLogsResult",
    peerTerminated = "peerTerminated",
    error = "error",
    ok = "ok",
    unauthorized = "",
}

export interface IMsg {
    type: any;
    data: any | { error?: any };
}

export enum AuthUserRoles {
    admin = "admin"
    , user = "user"
    , guest = "guest"
}

export class ErrorMsg implements IMsg {
    type = payloadTypeServer.error;
    data = {
        error: ""
    }

    constructor(msgType: any, error: string) {
        this.type = msgType;
        this.data.error = error;
    }
}

export class OkMsg implements IMsg {
    type = payloadTypeServer.ok;
    data = {}

    constructor(msgType?: any, data?: {}) {
        if (msgType) {
            this.type = msgType;
        }
        if (data) {
            this.data = data
        }
    }
}

export class RegisterPeerMsg implements IMsg {
    type = payloadTypeClient.registerPeer;
    data: {
        authToken?: string,
        displayName?: string,
        /**
         * your app's unique to track the room
         */
        peerTrackingId?: string,
    } = {}
}

export class RegisterPeerResultMsg implements IMsg {
    type = payloadTypeServer.registerPeerResult;
    data: {
        peerId?: string,
        displayName?: string,
        rtpCapabilities?: any,
        error?: string
    } = {};
}

export class TerminatePeerMsg implements IMsg {
    type = payloadTypeClient.terminatePeer;
    data: {
        authToken?: string,
        peerId?: string,
    } = {};
}

export class PeerTerminatedMsg implements IMsg {
    type = payloadTypeServer.peerTerminated;
    data: {
        peerId?: string,
        error?: string
    } = {};
}

export class CreateProducerTransportMsg implements IMsg {
    type = payloadTypeClient.createProducerTransport;
    data: {
        authToken?: string,
        roomId?: string,
    } = {}
}

export class ProducerTransportCreatedMsg implements IMsg {
    type = payloadTypeServer.producerTransportCreated;
    data: {
        roomId?: string,
        transportId?: string,
        iceParameters?: any,
        iceServers?: any,
        iceCandidates?: any,
        dtlsParameters?: any,
        iceTransportPolicy?: any,
    } = {};
}

export class ProducerTransportConnectedMsg implements IMsg {
    type = payloadTypeServer.producerTransportConnected;
    data: {
        roomId?: string,
        error?: any,
    } = {};
}

export class ConnectProducerTransportMsg implements IMsg {
    type = payloadTypeClient.connectProducerTransport;
    data: {
        authToken?: string,
        roomId?: string,
        dtlsParameters?: any
    } = {}
}

export class CreateConsumerTransportMsg implements IMsg {
    type = payloadTypeClient.createConsumerTransport;
    data: {
        authToken?: string,
        roomId?: string,
    } = {}
}

export class ConsumerTransportCreatedMsg implements IMsg {
    type = payloadTypeServer.consumerTransportCreated;
    data: {
        roomId?: string,
        transportId?: string,
        iceParameters?: any,
        iceServers?: any,
        iceCandidates?: any,
        dtlsParameters?: any,
        iceTransportPolicy?: any,
    } = {};
}

export class ConsumerTransportConnectedMsg implements IMsg {
    type = payloadTypeServer.consumerTransportConnected;
    data: {
        roomId?: string,
        error?: any,
    } = {};
}

export class ConnectConsumerTransportMsg implements IMsg {
    type = payloadTypeClient.connectConsumerTransport;
    data: {
        authToken?: string,
        roomId?: string,
        dtlsParameters?: any
    } = {};
}

export class RoomNewMsg implements IMsg {
    type = payloadTypeClient.roomNew;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string,
        roomName?: string,
        roomTrackingId?: string,
        adminTrackingId?: string,
        roomConfig?: RoomConfig;
    } = {
            roomConfig: new RoomConfig()
        }
}

export class AuthUserNewTokenMsg implements IMsg {
    type = payloadTypeClient.authUserNewToken;
    data: {
        role?: AuthUserRoles;
        expiresInMin?: number
    } = {}
}

export class AuthUserNewTokenResultMsg implements IMsg {
    type = payloadTypeServer.authUserNewTokenResult;
    data: {
        authToken?: string,
        expiresIn?: number,
        role?: AuthUserRoles;
        error?: string
    } = {
        }
}

export class RoomNewTokenMsg implements IMsg {
    type = payloadTypeClient.roomNewToken;
    data: {
        authToken?: string,
        expiresInMin?: number
    } = {}
}

export class RoomNewTokenResultMsg implements IMsg {
    type = payloadTypeClient.roomNewTokenResult;
    data: {
        roomId?: string,
        roomToken?: string
        error?: string
    } = {}
}

export class RoomNewResultMsg implements IMsg {
    type = payloadTypeServer.roomNewResult;
    data: {
        peerId?: string,
        roomId?: string,
        roomToken?: string,
        roomRtpCapabilities?: any;
        /**
         * your app's unique to track the room
         */
        roomTrackingId?: string,
        error?: string,
    } = {}
}

export class RoomJoinMsg implements IMsg {
    type = payloadTypeClient.roomJoin;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string,
    } = {}
}

export class RoomLeaveMsg implements IMsg {
    type = payloadTypeClient.roomLeave;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string
    } = {}
}

export class RoomLeaveResultMsg implements IMsg {
    type = payloadTypeServer.roomLeaveResult;
    data: {
        roomId?: string,
        error?: string
    } = {}
}

export class RoomClosedMsg implements IMsg {
    type = payloadTypeServer.roomClosed;
    data: {
        roomId?: string
    } = {}
}

export class RoomJoinResultMsg implements IMsg {
    type = payloadTypeServer.roomJoinResult;
    data: {
        roomId?: string,
        roomToken?: string,
        peers?: {
            peerId: string,
            peerTrackingId: string,
            displayName: string,
            producers?: { producerId: string, kind: "audio" | "video" }[],
            trackInfo?: PeerTracksInfo,
        }[],
        error?: string,
    } = { peers: [] };
}

export class RoomNewPeerMsg implements IMsg {
    type = payloadTypeServer.roomNewPeer;
    data: {
        peerId?: string,
        peerTrackingId?: string,
        roomId?: string,
        displayName?: string,
        producers?: { producerId: string, kind: "audio" | "video" }[],
        trackInfo?: PeerTracksInfo,
    } = {};
}

export class RoomPeerLeftMsg implements IMsg {
    type = payloadTypeServer.roomPeerLeft;
    data: {
        peerId?: string;
        roomId?: string;
    } = {};
}

export class RoomNewProducerMsg implements IMsg {
    type = payloadTypeServer.roomNewProducer;
    data: {
        authToken?: string,
        roomId?: string,
        peerId?: string,
        producerId?: string,
        kind?: string,
    } = {};
}

export class RoomTerminateMsg implements IMsg {
    type = payloadTypeClient.roomTerminate;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string
    } = {}
}

export class RoomTerminateResultMsg implements IMsg {
    type = payloadTypeServer.roomTerminateResult;
    data: {
        roomId?: string,
        error?: string
    } = {}
}

export class RoomCloseProducerMsg implements IMsg {
    type = payloadTypeClient.roomCloseProducer;
    data: {
        roomId?: string,
        kinds?: ("audio" | "video")[]
    } = {};
}

export class RoomProduceStreamMsg implements IMsg {
    type = payloadTypeClient.roomProduceStream;
    data: {
        roomId?: string,
        kind?: "audio" | "video",
        rtpParameters?: any
    } = {};
}

export class RoomProduceStreamResultMsg implements IMsg {
    type = payloadTypeServer.roomProduceStreamResult;
    data: {
        roomId?: string,
        kind?: "audio" | "video"
    } = {};
}

export class RoomConsumeStreamMsg implements IMsg {
    type = payloadTypeClient.roomConsumeStream;
    data: {
        roomId?: string,
        remotePeerId?: string,
        producerId?: string,
        rtpCapabilities?: any
        error?: string
    } = {};
}

export class RoomConsumeStreamResultMsg implements IMsg {
    type = payloadTypeServer.roomConsumeStreamResult;
    data: {
        roomId?: string,
        peerId?: string
        consumerId?: string,
        producerId?: string,
        kind?: "audio" | "video",
        rtpParameters?: any,
        error?: string,
    } = {};
}

export class RoomConsumerClosedMsg implements IMsg {
    type = payloadTypeServer.roomConsumerClosed;
    data: {
        roomId?: string,
        producerId?: string,
        consumerId?: string,
        kind?: "audio" | "video",
    } = {};
}

export class PeerTracksInfoMsg {
    type = payloadTypeClient.peerTracksInfo
    data: {
        peerId?: string,
        tracksInfo?: PeerTracksInfo;
    } = {}
}

export class PeerMuteTracksMsg {
    type = payloadTypeClient.peerMuteTracks
    data: {
        roomId?: string,
        peerId?: string,
        tracksInfo?: PeerTracksInfo;
    } = {}
}

export interface PeerTracksInfo {
    isAudioEnabled: boolean,
    isVideoEnabled?: boolean
}

export class UnauthorizedMsg implements IMsg {
    type = payloadTypeServer.unauthorized;
    data: {
        error?: string
    } = {};
}

export enum RoomServerAPIRoutes {
    newAuthUserToken = "/newAuthUserToken",
    newRoomToken = "/newRoomToken",
    newRoom = "/newRoom",
    terminateRoom = "/terminateRoom"
}

export class RoomConfig {
    maxPeers = 99;
    newRoomTokenExpiresInMinutes = 30; //room token expiration from date created
    maxRoomDurationMinutes = 30; // room max duration, starts when the room is created
    timeOutNoParticipantsSecs = 5 * 60; //when no participants in the room, timer starts and will close the room 
    closeRoomOnPeerCount = 0; //room will be closed when there are x number of peers
    callBackURL_OnRoomClosed: string;
    callBackURL_OnPeerLeft: string;
    callBackURL_OnPeerJoined: string;
}

export enum payloadTypeCallBacks {
    roomPeerCallBackMsg = "roomPeerCallBackMsg",
    roomCallBackMsg = "roomCallBackMsg",

}
export class RoomPeerCallBackMsg implements IMsg {
    type: payloadTypeCallBacks.roomPeerCallBackMsg;
    data: {
        peerId?: string;
        peerTrackingId?: string;
        roomId?: string;
        roomTrackingId?: string;
    } = {}
}

export class RoomCallBackMsg implements IMsg {
    type: payloadTypeCallBacks.roomCallBackMsg;
    data: {
        roomId?: string;
        roomTrackingId?: string;
        status?: "open" | "closed";
        peers?: RoomPeerCallBackMsg[];
    } = {}
}

export enum RoomLogAction {
    roomCreated = "roomCreated",
    roomClosed = "roomClosed",
    peerJoined = "peerJoined",
    peerLeft = "peerLeft"
}

export interface RoomLog {
    RoomId: string,
    PeerId: string,
    Date: Date,
    Action: RoomLogAction
}

export class RoomGetLogsMsg implements IMsg {
    type: payloadTypeClient.roomGetLogs;
    data = {};
}

export class RoomGetLogsResultMsg implements IMsg {
    type: payloadTypeServer.roomGetLogsResult;
    data: {
        logs: RoomLog[]
    } = { logs: [] };
}

export class UniqueMap<K, T> {

    private items = new Map<K, T>()

    set(key: K, item: T) {
        if (this.items.has(key)) {
            throw `already has and item with ${key}`;
        }
        this.items.set(key, item);
    }

    has(key: K) {
        return this.items.has(key);
    }

    delete(key: K) {
        return this.items.delete(key);
    }

    keys() {
        return [...this.items.keys()];
    }

    values() {
        return [...this.items.values()];
    }

    get(key: K) {
        return this.items.get(key);
    }

    clear() {
        this.items.clear();
    }
    get size() {
        return this.items.size;
    }
}