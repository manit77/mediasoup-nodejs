/**
 * server receives these payload types
 */
export const payloadTypeClient = {
    authUserNewToken : "authUserNewToken",

    registerPeer : "registerPeer",
    terminatePeer : "terminatePeer",

    createProducerTransport : "createProducerTransport",
    createConsumerTransport : "createConsumerTransport",
    connectProducerTransport : "connectProducerTransport",
    connectConsumerTransport : "connectConsumerTransport",

    roomNewToken : "roomNewToken",
    roomNewTokenResult : "roomNewTokenResult",
    roomNew : "roomNew",
    roomJoin : "roomJoin",
    roomLeave : "roomLeave",
    roomTerminate : "roomTerminate",
    roomPong : "roomPong",
    roomRecordingStart : "roomRecordingStart",
    roomRecordingStop : "roomRecordingStop",

    roomGetLogs : "roomGetLogs",
    roomGetStatus : "roomGetStatus",

    roomProduceStream : "roomProduceStream",
    roomCloseProducer : "roomCloseProducer",
    roomConsumeProducer : "roomConsumeProducer",

    peerTracksInfo : "peerTracksInfo",
    peerMuteTracks : "peerMuteTracks",
}


/**
 * server sends these payload types
 */
export const payloadTypeServer = {

    authUserNewTokenResult : "authUserNewTokenResult",
    registerPeerResult : "registerPeerResult",

    //createProducerTransport : "createProducerTransport",
    createProducerTransportResult : "createProducerTransportResult",
    connectProducerTransportResult : "connectProducerTransportResult",
    producerTransportConnected : "producerTransportConnected",

    //consumerTransportCreated : "consumerTransportCreated",
    createConsumerTransportResult : "createConsumerTransportResult",
    connectConsumerTransportResult : "connectConsumerTransportResult",
    consumerTransportConnected : "consumerTransportConnected",

    roomProduceStreamResult : "roomProduceStreamResult",
    roomConsumeProducerResult : "roomConsumeProducerResult",
    roomConsumerClosed : "roomConsumerClosed",

    roomNewResult : "roomNewResult",
    roomNewTokenResult : "roomNewTokenResult",
    roomJoinResult : "roomJoinResult",
    roomLeaveResult : "roomLeaveResult",
    roomNewPeer : "roomNewPeer",
    roomNewProducer : "roomNewProducer",
    roomPeerLeft : "roomPeerLeft",
    roomTerminateResult : "roomTerminateResult",
    roomGetStatusResult : "roomGetStatusResult",
    roomClosed : "roomClosed",
    roomPing : "roomPing",
    roomGetLogsResult : "roomGetLogsResult",
    roomRecordingStartResult : "roomRecordingStartResult",

    peerTerminated : "peerTerminated",
    error : "error",
    ok : "ok",
    unauthorized : "unauthorized",
    //notRegistered = "notRegistered",
}

export interface IMsg {
    type: string;    
    error?: string;
    data?: any;
}

export class BaseMsg implements IMsg {
    type: string;    
    error?: string;
    data: any;
}

export enum AuthUserRoles {
    admin = "admin"
    , user = "user"
    , guest = "guest"
}

export class ErrorMsg extends BaseMsg {
    type = payloadTypeServer.error;  
    constructor(msgType: any, error: string) {
        super();        
        this.type = msgType;
        this.error = error;
    }
}

export class OkMsg extends BaseMsg {
    type = payloadTypeServer.ok;
    data = {}

    constructor(msgType?: any, data?: {}) {
        super();

        if (msgType) {
            this.type = msgType;
        }
        if (data) {
            this.data = data
        }
    }
}

export class RegisterPeerMsg extends BaseMsg {
    type = payloadTypeClient.registerPeer;
    data: {
        authToken?: string,
        username?: string,
        displayName?: string,
        /**
         * your app's unique to track the room
         */
        peerTrackingId?: string,
    } = {}
}

export class RegisterPeerResultMsg extends BaseMsg {
    type = payloadTypeServer.registerPeerResult;
    data: {
        peerId?: string,
        displayName?: string,
        rtpCapabilities?: any,        
    } = {};
}

export class TerminatePeerMsg extends BaseMsg {
    type = payloadTypeClient.terminatePeer;
    data: {
        authToken?: string,
        peerId?: string,
    } = {};
}

export class PeerTerminatedMsg extends BaseMsg {
    type = payloadTypeServer.peerTerminated;
    data: {
        peerId?: string,       
    } = {};
}

export class CreateProducerTransportMsg extends BaseMsg {
    type = payloadTypeClient.createProducerTransport;
    data: {
        authToken?: string,
        roomId?: string,
    } = {}
}

export class CreateProducerTransportResultMsg extends BaseMsg {
    type = payloadTypeServer.createProducerTransportResult;
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

export class ProducerTransportConnectedMsg extends BaseMsg {
    type = payloadTypeServer.producerTransportConnected;
    data: {
        roomId?: string        
    } = {};
}

export class ConnectProducerTransportMsg extends BaseMsg {
    type = payloadTypeClient.connectProducerTransport;
    data: {
        transportId?: string,
        authToken?: string,
        roomId?: string,
        dtlsParameters?: any
    } = {}
}

export class CreateConsumerTransportMsg extends BaseMsg {
    type = payloadTypeClient.createConsumerTransport;
    data: {
        authToken?: string,
        roomId?: string,
    } = {}
}

export class CreateConsumerTransportResultMsg extends BaseMsg {
    type = payloadTypeServer.createConsumerTransportResult;
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

export class ConsumerTransportConnectedMsg extends BaseMsg {
    type = payloadTypeServer.consumerTransportConnected;
    data: {
        roomId?: string        
    } = {};
}

export class ConnectConsumerTransportMsg extends BaseMsg {
    type = payloadTypeClient.connectConsumerTransport;
    data: {
        transportId?: string,
        authToken?: string,
        roomId?: string,
        dtlsParameters?: any
    } = {};
}

export class RoomNewMsg extends BaseMsg {
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

export class AuthUserNewTokenMsg extends BaseMsg {
    type = payloadTypeClient.authUserNewToken;
    data: {
        username?: string;
        role?: AuthUserRoles;
        expiresInMin?: number;
    } = {}
}

export class AuthUserNewTokenResultMsg extends BaseMsg {
    type = payloadTypeServer.authUserNewTokenResult;
    data: {
        authToken?: string,
        expiresIn?: number,
        role?: AuthUserRoles;        
    } = {
        }
}

export class RoomNewTokenMsg extends BaseMsg {
    type = payloadTypeClient.roomNewToken;
    data: {
        authToken?: string,
        expiresInMin?: number
    } = {}
}

export class RoomNewTokenResultMsg extends BaseMsg {
    type = payloadTypeClient.roomNewTokenResult;
    data: {
        roomId?: string,
        roomToken?: string        
    } = {}
}

export class RoomNewResultMsg extends BaseMsg {
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
    } = {}
}

export class RoomJoinMsg extends BaseMsg {
    type = payloadTypeClient.roomJoin;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string,
    } = {}
}

export class RoomLeaveMsg extends BaseMsg {
    type = payloadTypeClient.roomLeave;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string
    } = {}
}

export class RoomLeaveResultMsg extends BaseMsg {
    type = payloadTypeServer.roomLeaveResult;
    data: {
        roomId?: string,       
    } = {}
}

export class RoomClosedMsg extends BaseMsg {
    type = payloadTypeServer.roomClosed;
    data: {
        roomId?: string
    } = {}
}

export class RoomJoinResultMsg extends BaseMsg {
    type = payloadTypeServer.roomJoinResult;
    data: {
        roomId?: string,
        roomToken?: string,
        roomRtpCapabilities?: any,
        //trackInfo?: PeerTracksInfo,
        peers?: {
            peerId: string,
            peerTrackingId: string,
            displayName: string,
            producers?: { producerId: string, kind: "audio" | "video" }[],
            trackInfo: PeerTracksInfo,
        }[],       
    } = { peers: [] };
}

export class RoomNewPeerMsg extends BaseMsg {
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

export class RoomPeerLeftMsg extends BaseMsg {
    type = payloadTypeServer.roomPeerLeft;
    data: {
        peerId?: string;
        roomId?: string;
    } = {};
}

export class RoomNewProducerMsg extends BaseMsg {
    type = payloadTypeServer.roomNewProducer;
    data: {
        authToken?: string,
        roomId?: string,
        peerId?: string,
        producerId?: string,
        kind?: string,
    } = {};
}

export class RoomGetStatusMsg extends BaseMsg {
    type = payloadTypeClient.roomGetStatus;
    data: {
        authToken?: string,
        roomId?: string
    } = {}
}

export class RoomTerminateMsg extends BaseMsg {
    type = payloadTypeClient.roomTerminate;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string
    } = {}
}

export class RoomGetStatusResultMsg extends BaseMsg {
    type = payloadTypeServer.roomGetStatusResult;
    data: {
        roomId?: string,
        numPeers?: number       
    } = {}
}

export class RoomTerminateResultMsg extends BaseMsg {
    type = payloadTypeServer.roomTerminateResult;
    data: {
        roomId?: string       
    } = {}
}

export class RoomCloseProducerMsg extends BaseMsg {
    type = payloadTypeClient.roomCloseProducer;
    data: {
        roomId?: string,
        kinds?: ("audio" | "video")[]
    } = {};
}

export class RoomProduceStreamMsg extends BaseMsg {
    type = payloadTypeClient.roomProduceStream;
    data: {
        roomId?: string,
        kind?: "audio" | "video",
        rtpParameters?: any
    } = {};
}

export class RoomProduceStreamResultMsg extends BaseMsg {
    type = payloadTypeServer.roomProduceStreamResult;
    data: {
        roomId?: string,
        kind?: "audio" | "video"
    } = {};
}

export class RoomConsumeProducerMsg extends BaseMsg {
    type = payloadTypeClient.roomConsumeProducer;
    data: {
        roomId?: string,
        remotePeerId?: string,
        producerId?: string,
        rtpCapabilities?: any       
    } = {};
}

export class roomConsumeProducerResultMsg extends BaseMsg {
    type = payloadTypeServer.roomConsumeProducerResult;
    data: {
        roomId?: string,
        peerId?: string
        consumerId?: string,
        producerId?: string,
        kind?: "audio" | "video",
        rtpParameters?: any      
    } = {};
}

export class RoomConsumerClosedMsg extends BaseMsg {
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
    isVideoEnabled: boolean,
    isAudioMuted?: boolean,
    isVideoMuted?: boolean
}

export class UnauthorizedMsg extends BaseMsg {
    type = payloadTypeServer.unauthorized;    
}

export enum RoomServerAPIRoutes {
    newAuthUserToken = "/newAuthUserToken",
    newRoomToken = "/newRoomToken",
    newRoom = "/newRoom",
    getRoomStatus = "/getRoomStatus",
    terminateRoom = "/terminateRoom",
    recCallBack = "/recCallBack",
    roomPong = "/roomPong",
}

export class RoomConfig {
    maxPeers = 99;
    newRoomTokenExpiresInMinutes = 30; //room token expiration from date created
    maxRoomDurationMinutes = 30; // room max duration, starts when the room is created
    timeOutNoParticipantsSecs = 5 * 60; //when no participants in the room, timer starts and will close the room 

    closeRoomOnPeerCount = 0; //room will be closed when there are x number of peers    
    guestsAllowMic = true;
    guestsAllowCamera = true;

    callBackURL_OnRoomClosed: string;
    callBackURL_OnPeerLeft: string;
    callBackURL_OnPeerJoined: string;
    isRecordable = false;
    isRecorded = false;
    closeOnRecordingFailed = true; //if recording fails, then close the room
    closeOnRecordingTimeoutSecs = 30; //if not recorded for 30 seconds, terminate room    
}

export enum payloadTypeCallBacks {
    roomPeerCallBackMsg = "roomPeerCallBackMsg",
    roomCallBackMsg = "roomCallBackMsg",
}

export class RoomPeerCallBackMsg extends BaseMsg {
    type = payloadTypeCallBacks.roomPeerCallBackMsg;
    data: {
        peerId?: string;
        peerTrackingId?: string;
        roomId?: string;
        roomTrackingId?: string;
    } = {}
}

export class RoomCallBackMsg extends BaseMsg {
    type = payloadTypeCallBacks.roomCallBackMsg;
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

export class RoomGetLogsMsg extends BaseMsg {
    type = payloadTypeClient.roomGetLogs;
    data = {};
}

export class RoomGetLogsResultMsg extends BaseMsg {
    type = payloadTypeServer.roomGetLogsResult;
    data: {
        logs: RoomLog[]
    } = { logs: [] };
}

export class RoomPingMsg extends BaseMsg {
    type = payloadTypeServer.roomPing;
    data: {
        roomId?: string
    } = {};
}

export class RoomPongMsg extends BaseMsg {
    type = payloadTypeClient.roomPong;
    data: {
        roomId?: string,
        peerTrackingId?: string,
        authToken?: string,
    } = {};
}

export class RoomRecordingStart extends BaseMsg {
    type = payloadTypeClient.roomRecordingStart;
    data: {
        roomId?: string
    } = {};
}

export class RoomRecordingStop extends BaseMsg {
    type = payloadTypeClient.roomRecordingStop;
    data: {
        roomId?: string
    } = {};
}

export class UniqueMap<K, T> {

    private items = new Map<K, T>()

    set(key: K, item: T) {
        if (this.items.has(key)) {
            throw `UniqueMap already has a key: ${key}`;
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


export class TestObject {
    hello() {
        console.error("hello");
    }
}