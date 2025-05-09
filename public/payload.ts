import * as mediasoup from 'mediasoup-client';

/**
 * server receives these payload types
 */
export enum payloadTypeClient {
    register = "register",

    createProducerTransport = "createProducerTransport",
    createConsumerTransport = "createConsumerTransport",
    connectProducerTransport = "connectProducerTransport",
    connectConsumerTransport = "connectConsumerTransport",

    roomJoin = "roomJoin",
    roomLeave = "roomLeave",

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

    roomJoinResult = "roomJoinResult",
    roomNewPeer = "roomNewPeer",
    roomNewProducer = "roomNewProducer",
    roomPeerLeft = "roomPeerLeft",

}

export class RegisterMsg {
    private type = payloadTypeClient.register;
    authToken: string = "";
    displayName: string = "";
}

export class RegisterResultMsg {
    private type = payloadTypeServer.registerResult;
    data?: {
        peerid: string,
        displayName: string,
        rtpCapabilities: any,
    };
}

export class CreateProducerTransportMsg {
    private type = payloadTypeClient.createProducerTransport;
}

export class ProducerTransportCreatedMsg {
    private type = payloadTypeServer.producerTransportCreated;
    data?: {
        transportId: string,
        iceParameters: any,
        iceServers: any,
        iceCandidates: any,
        dtlsParameters: any,
        iceTransportPolicy: any,
    };
}

export class ConnectProducerTransportMsg {
    private type = payloadTypeClient.connectProducerTransport;
    data?: {
        dtlsParameters: any
    }
}

export class CreateConsumerTransportMsg {
    private type = payloadTypeClient.createConsumerTransport;
}

export class ConsumerTransportCreatedMsg {
    private type = payloadTypeServer.consumerTransportCreated;
    data?: {
        transportId: string,
        iceParameters: any,
        iceServers: any,
        iceCandidates: any,
        dtlsParameters: any,
        iceTransportPolicy: any,
    }
}

export class ConnectConsumerTransportMsg {
    private type = payloadTypeClient.connectConsumerTransport;
    data?: {
        dtlsParameters: any
    }
}

export class RoomJoinMsg {
    private type = payloadTypeClient.roomJoin;
    data?: {
        roomId: string,
        roomToken: string
    }
}

export class RoomLeaveMsg {
    private type = payloadTypeClient.roomLeave;
    data?: {
        roomId: string,
        roomToken: string
    }
}

export class RoomJoinResultMsg {
    private type = payloadTypeServer.roomJoinResult;
    data?: {
        roomId: string,
        peers: {
            peerId: string,
            producers?: { producerId: string, kind: "audio" | "video" }[]
        }[]
    };
}

export class RoomNewPeerMsg {
    private type = payloadTypeServer.roomNewPeer;
    data: {
        peerId: string;
        displayName: string;
        producers?: { producerId: string, kind: "audio" | "video" }[]
    } | undefined;
}

export class RoomPeerLeftMsg {
    private type = payloadTypeServer.roomPeerLeft;
    data: {
        peerId: string;
        roomId: string;        
    } | undefined;
}

export class RoomNewProducerMsg {
    private type = payloadTypeServer.roomNewProducer;
    data?: {
        peerId: string,
        producerId: string,
        kind: string,
    };
}



export class ProduceMsg {
    private type = payloadTypeClient.produce;
    data?: {
        kind: "audio" | "video",
        rtpParameters: any
    };
}

export class ProducedMsg {
    private type = payloadTypeServer.produced;
    data?: {
        kind: "audio" | "video"
    };
}

export class ConsumeMsg {
    type = payloadTypeClient.consume;
    data?: {
        remotePeerId: string,
        producerId: string,
        rtpCapabilities: any
    };
}

export class ConsumedMsg {
    type = payloadTypeServer.consumed;
    data?: {
        peerId: string
        consumerId: string,
        producerId: string,
        kind: "audio" | "video",
        rtpParameters: any,
    };
}
