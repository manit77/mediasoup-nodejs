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

    rtc_needOffer = "rtc_needOffer",
    rtc_offer = "rtc_offer",
    rtc_answer = "rtc_answer",
    rtc_ice = "rtc_ice",

    produce = "produce",
    consume = "consume",
}


/**
 * server sends these payload types
 */
export enum payloadTypeServer {

    authUserNewTokenResult = "authUserNewTokenResult",
    registerPeerResult = "registerPeerResult",

    producerTransportCreated = "producerTransportCreated",
    consumerTransportCreated = "consumerTransportCreated",
    produced = "produced",
    consumed = "consumed",

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

    rtc_needOffer = "rtc_needOffer",
    rtc_offer = "rtc_offer",
    rtc_answer = "rtc_answer",
    rtc_ice = "rtc_ice",

    peerTerminated = "peerTerminated",
    error = "error",
    ok = "ok",
    unauthorized = "",


}

export interface IMsg {
    type: any;
    data: any;
}

export class ErrorMsg implements IMsg {
    type = payloadTypeServer.error;
    data = {
        error: ""
    }

    constructor(error: string) {
        this.data.error = error;
    }
}

export class OkMsg implements IMsg {
    type = payloadTypeServer.ok;
    data = {
        payload: ""
    }

    constructor(payload: any) {
        this.data.payload = payload;
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
        trackingId?: string,
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
        authToken?: string
    } = {}
}

export class ProducerTransportCreatedMsg implements IMsg {
    type = payloadTypeServer.producerTransportCreated;
    data: {
        authToken?: string,
        transportId?: string,
        iceParameters?: any,
        iceServers?: any,
        iceCandidates?: any,
        dtlsParameters?: any,
        iceTransportPolicy?: any,
    } = {};
}

export class ConnectProducerTransportMsg implements IMsg {
    type = payloadTypeClient.connectProducerTransport;
    data: {
        authToken?: string,
        dtlsParameters?: any
    } = {}
}

export class CreateConsumerTransportMsg implements IMsg {
    type = payloadTypeClient.createConsumerTransport;
    data: {
        authToken?: string
    } = {}
}

export class ConsumerTransportCreatedMsg implements IMsg {
    type = payloadTypeServer.consumerTransportCreated;
    data: {
        authToken?: string,
        transportId?: string,
        iceParameters?: any,
        iceServers?: any,
        iceCandidates?: any,
        dtlsParameters?: any,
        iceTransportPolicy?: any,
    } = {};
}

export class ConnectConsumerTransportMsg implements IMsg {
    type = payloadTypeClient.connectConsumerTransport;
    data: {
        authToken?: string,
        dtlsParameters?: any
    } = {};
}

//creates a new room token
export class RoomNewMsg implements IMsg {
    type = payloadTypeClient.roomNew;
    data: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string,
        roomConfig?: RoomConfig;
    } = {
            roomConfig: new RoomConfig()
        }
}

export class AuthUserNewTokenMsg implements IMsg {
    type = payloadTypeClient.authUserNewToken;
    data: {
        authToken?: string,
        expiresInMin?: number
    } = {}
}

export class AuthUserNewTokenResultMsg implements IMsg {
    type = payloadTypeServer.authUserNewTokenResult;
    data: {
        authToken?: string,
        expiresIn?: number
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
        /**
         * your app's unique to track the room
         */
        trackingId?: string,
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

export class RoomLeaveResult implements IMsg {
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
        rtpCapabilities?: any,
        roomType?: RoomType,
        peers?: {
            peerId: string,
            producers?: { producerId: string, kind: "audio" | "video" }[]
        }[],
        error?: string,
    } = { peers: [] };
}

export class RoomNewPeerMsg implements IMsg {
    type = payloadTypeServer.roomNewPeer;
    data: {
        peerId?: string;
        roomId?: string;
        displayName?: string;
        producers?: { producerId: string, kind: "audio" | "video" }[]
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

export class ProduceMsg implements IMsg {
    type = payloadTypeClient.produce;
    data: {
        authToken?: string,
        kind?: "audio" | "video",
        rtpParameters?: any
    } = {};
}

export class ProducedMsg implements IMsg {
    type = payloadTypeServer.produced;
    data: {
        kind?: "audio" | "video"
    } = {};
}

export class ConsumeMsg implements IMsg {
    type = payloadTypeClient.consume;
    data: {
        authToken?: string,
        remotePeerId?: string,
        producerId?: string,
        rtpCapabilities?: any
    } = {};
}

export class ConsumedMsg implements IMsg {
    type = payloadTypeServer.consumed;
    data: {
        peerId?: string
        consumerId?: string,
        producerId?: string,
        kind?: "audio" | "video",
        rtpParameters?: any,
    } = {};
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
    roomType = RoomType.sfu;
    maxPeers = 2;
    newRoomTokenExpiresInMinutes = 30; //room token expiration from date created
    maxRoomDurationMinutes = 30; // room max duration, starts when the room is created
    timeOutNoParticipantsSecs = 5 * 60; //when no participants in the room, timer starts and will close the room 
    closeRoomOnPeerCount = 0; //room will be closed when there are x number of peers
    callBackURL_OnRoomClosed: string;
    callBackURL_OnPeerLeft: string;
    callBackURL_OnPeerJoined: string;
}

export enum RoomType {
    "sfu" = "sfu",
    "p2p" = "p2p"
}

export class RTCNeedOfferMsg implements IMsg {
    type = payloadTypeClient.rtc_needOffer;
    data: {
        remotePeerId?: string,
        sdp?: any
    } = {};
}

export class RTCOfferMsg implements IMsg {
    type = payloadTypeClient.rtc_offer;
    data: {
        remotePeerId?: string,
        sdp?: any
    } = {};
}

export class RTCAnswerMsg implements IMsg {
    type = payloadTypeClient.rtc_answer;
    data: {
        remotePeerId?: string,
        sdp?: any
    } = {};
}

export class RTCIceMsg implements IMsg {
    type = payloadTypeClient.rtc_ice;
    data: {
        remotePeerId?: string,
        candidate?: any
    } = {};
}

export interface RoomPeerCallBackData {
    peerId: string;
    peerTrackingId: string;
    roomId: string;
    roomTrackingId: string;
}

export interface RoomCallBackData {
    roomId: string;
    trackingId: string;
    status: "open" | "closed";
    peers: RoomPeerCallBackData[];
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