/**
 * server receives these payload types
 */
export enum payloadTypeClient {
    register = "register",
    terminatePeer = "terminatePeer",

    createProducerTransport = "createProducerTransport",
    createConsumerTransport = "createConsumerTransport",
    connectProducerTransport = "connectProducerTransport",
    connectConsumerTransport = "connectConsumerTransport",

    authUserNewToken = "authUserNewToken",
    authUserNewTokenResult = "authUserNewTokenResult",

    roomNewToken = "roomNewToken",
    roomNewTokenResult = "roomNewTokenResult",
    roomNew = "roomNew",
    roomJoin = "roomJoin",
    roomLeave = "roomLeave",
    roomTerminate = "roomTerminate",

    produce = "produce",
    consume = "consume",
}

/**
 * server sends these payload types
 */
export enum payloadTypeServer {

    registerResult = "registerResult",

    producerTransportCreated = "producerTransportCreated",
    consumerTransportCreated = "consumerTransportCreated",
    produced = "produced",
    consumed = "consumed",

    roomNewResult = "roomNewResult",
    roomJoinResult = "roomJoinResult",
    roomNewPeer = "roomNewPeer",
    roomNewProducer = "roomNewProducer",
    roomPeerLeft = "roomPeerLeft",
    roomTerminate = "roomTerminate",

}

export class RegisterMsg {
    private type = payloadTypeClient.register;
    data: {
        authToken?: string,
        displayName?: string,
        trackingId?: string
    } = {}
}

export class RegisterResultMsg {
    private type = payloadTypeServer.registerResult;
    data?: {        
        peerId?: string,
        trackingId?: string,
        displayName?: string,
        rtpCapabilities?: any,
        error?: string
    } = {};
}

export class TerminatePeerMsg {
    private type = payloadTypeClient.terminatePeer;
    data: {
        peerId?: string,        
        displayName?: string;
    } = {};
}

export class CreateProducerTransportMsg {
    private type = payloadTypeClient.createProducerTransport;
    data : {
         authToken?: string
    } = { }
}

export class ProducerTransportCreatedMsg {
    private type = payloadTypeServer.producerTransportCreated;
    data?: {
        authToken?: string,
        transportId?: string,
        iceParameters?: any,
        iceServers?: any,
        iceCandidates?: any,
        dtlsParameters?: any,
        iceTransportPolicy?: any,
    } = {};
}

export class ConnectProducerTransportMsg {
    private type = payloadTypeClient.connectProducerTransport;
    data: {
        authToken?: string,
        dtlsParameters?: any
    } = {}
}

export class CreateConsumerTransportMsg {
    private type = payloadTypeClient.createConsumerTransport;
    data: {
        authToken?: string
    } = {}
}

export class ConsumerTransportCreatedMsg {
    private type = payloadTypeServer.consumerTransportCreated;
    data?: {
        authToken?: string,
        transportId?: string,
        iceParameters?: any,
        iceServers?: any,
        iceCandidates?: any,
        dtlsParameters?: any,
        iceTransportPolicy?: any,
    } = {};
}

export class ConnectConsumerTransportMsg {
    private type = payloadTypeClient.connectConsumerTransport;
    data?: {
        authToken?: string,
        dtlsParameters?: any
    } = {};
}

//creates a new room token
export class RoomNewMsg {
    private type = payloadTypeClient.roomNew;
    data?: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string,
        roomConfig?: RoomConfig;
    } = {
            roomConfig: new RoomConfig()
        }
}

export class AuthUserNewTokenMsg {
    private type = payloadTypeClient.authUserNewToken;
    data: {
        accessToken?: string,
        expiresInMin?: number
    } = {}
}

export class AuthUserNewTokenResultMsg {
    private type = payloadTypeClient.authUserNewTokenResult;
    data: {       
        authToken?: string,
        error?: string
    } = {        
    }
}

export class RoomNewTokenMsg {
    private type = payloadTypeClient.roomNewToken;
    data?: {
        authToken?: string,
        expiresInMin?: number   
    } = { }
}

export class RoomNewTokenResultMsg {
    private type = payloadTypeClient.roomNewTokenResult;
    data?: {       
        roomId?: string,
        roomToken?: string        
        error?: string
    } = {}
}

export class RoomNewResultMsg {
    private type = payloadTypeServer.roomNewResult;
    data?: {
        peerId?: string,
        roomId?: string,
        roomToken?: string,
        error?: string,
    } = {}
}

export class RoomJoinMsg {
    private type = payloadTypeClient.roomJoin;
    data?: {
        authToken?: string,
        peerId?: string,
        trackingId?: string,
        roomId?: string,
        roomToken?: string,
        maxPeers?: number
    } = {}
}

export class RoomLeaveMsg {
    private type = payloadTypeClient.roomLeave;
    data?: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string
    } = {}
}

export class RoomJoinResultMsg {
    private type = payloadTypeServer.roomJoinResult;
    data?: {
        roomId?: string,
        roomToken?: string,
        error?: string,
        peers?: {
            peerId: string,
            trackingId: string,
            producers?: { producerId: string, kind: "audio" | "video" }[]
        }[]
    } = { peers: [] };
}

export class RoomNewPeerMsg {
    private type = payloadTypeServer.roomNewPeer;
    data?: {
        peerId?: string;
        trackingId?: string,
        displayName?: string;
        producers?: { producerId: string, kind: "audio" | "video" }[]
    } = {};
}

export class RoomPeerLeftMsg {
    private type = payloadTypeServer.roomPeerLeft;
    data?: {
        peerId?: string;
        trackingId?: string,
        roomId?: string;
    } = {};
}

export class RoomNewProducerMsg {
    private type = payloadTypeServer.roomNewProducer;
    data?: {
        authToken?: string,
        peerId?: string,
        trackingId?: string,
        producerId?: string,
        kind?: string,
    } = {};
}

export class RoomTerminateMsg {
    private type = payloadTypeClient.roomTerminate;
    data?: {
        authToken?: string,
        peerId?: string,
        roomId?: string,
        roomToken?: string
    } = {}
}

export class ProduceMsg {
    private type = payloadTypeClient.produce;
    data?: {
        authToken?: string,
        kind?: "audio" | "video",
        rtpParameters?: any
    } = {};
}

export class ProducedMsg {
    private type = payloadTypeServer.produced;
    data?: {
        kind?: "audio" | "video"
    } = {};
}

export class ConsumeMsg {
    type = payloadTypeClient.consume;
    data?: {
        authToken?: string,
        remotePeerId?: string,
        producerId?: string,
        rtpCapabilities?: any
    } = {};
}

export class ConsumedMsg {
    type = payloadTypeServer.consumed;
    data?: {
        peerId?: string
        trackingId?: string,
        consumerId?: string,
        producerId?: string,
        kind?: "audio" | "video",
        rtpParameters?: any,
    } = {};
}


export enum RoomServerAPIRoutes {
    newAuthUserToken = "/newAuthUserToken",
    newRoomToken = "/newRoomToken",
    newRoom = "/newRoom",
    terminateRoom = "/terminateRoom"
}

export class RoomConfig {
    maxPeers = 2;
    newRoomTokenExpiresInMinutes = 30; //room token expiration from date created
    maxRoomDurationMinutes = 30; // room max duration, starts when the room is created
    timeOutNoParticipantsSecs = 5 * 60; //when no participants in the room, timer starts and will close the room 
}