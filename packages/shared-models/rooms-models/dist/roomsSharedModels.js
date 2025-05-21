/**
 * server receives these payload types
 */
export var payloadTypeClient;
(function (payloadTypeClient) {
    payloadTypeClient["authUserNewToken"] = "authUserNewToken";
    payloadTypeClient["registerPeer"] = "registerPeer";
    payloadTypeClient["terminatePeer"] = "terminatePeer";
    payloadTypeClient["createProducerTransport"] = "createProducerTransport";
    payloadTypeClient["createConsumerTransport"] = "createConsumerTransport";
    payloadTypeClient["connectProducerTransport"] = "connectProducerTransport";
    payloadTypeClient["connectConsumerTransport"] = "connectConsumerTransport";
    payloadTypeClient["roomNewToken"] = "roomNewToken";
    payloadTypeClient["roomNewTokenResult"] = "roomNewTokenResult";
    payloadTypeClient["roomNew"] = "roomNew";
    payloadTypeClient["roomJoin"] = "roomJoin";
    payloadTypeClient["roomLeave"] = "roomLeave";
    payloadTypeClient["roomTerminate"] = "roomTerminate";
    payloadTypeClient["roomTerminateResult"] = "roomTerminateResult";
    payloadTypeClient["produce"] = "produce";
    payloadTypeClient["consume"] = "consume";
})(payloadTypeClient || (payloadTypeClient = {}));
/**
 * server sends these payload types
 */
export var payloadTypeServer;
(function (payloadTypeServer) {
    payloadTypeServer["authUserNewTokenResult"] = "authUserNewTokenResult";
    payloadTypeServer["registerPeerResult"] = "registerPeerResult";
    payloadTypeServer["producerTransportCreated"] = "producerTransportCreated";
    payloadTypeServer["consumerTransportCreated"] = "consumerTransportCreated";
    payloadTypeServer["produced"] = "produced";
    payloadTypeServer["consumed"] = "consumed";
    payloadTypeServer["unauthorized"] = "";
    payloadTypeServer["roomNewResult"] = "roomNewResult";
    payloadTypeServer["roomNewTokenResult"] = "roomNewTokenResult";
    payloadTypeServer["roomJoinResult"] = "roomJoinResult";
    payloadTypeServer["roomLeaveResult"] = "roomLeaveResult";
    payloadTypeServer["roomNewPeer"] = "roomNewPeer";
    payloadTypeServer["roomNewProducer"] = "roomNewProducer";
    payloadTypeServer["roomPeerLeft"] = "roomPeerLeft";
    payloadTypeServer["roomTerminate"] = "roomTerminate";
    payloadTypeServer["peerTerminated"] = "peerTerminated";
})(payloadTypeServer || (payloadTypeServer = {}));
export class RegisterPeerMsg {
    constructor() {
        this.type = payloadTypeClient.registerPeer;
        this.data = {};
    }
}
export class RegisterPeerResultMsg {
    constructor() {
        this.type = payloadTypeServer.registerPeerResult;
        this.data = {};
    }
}
export class TerminatePeerMsg {
    constructor() {
        this.type = payloadTypeClient.terminatePeer;
        this.data = {};
    }
}
export class PeerTerminatedMsg {
    constructor() {
        this.type = payloadTypeServer.peerTerminated;
        this.data = {};
    }
}
export class CreateProducerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.createProducerTransport;
        this.data = {};
    }
}
export class ProducerTransportCreatedMsg {
    constructor() {
        this.type = payloadTypeServer.producerTransportCreated;
        this.data = {};
    }
}
export class ConnectProducerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.connectProducerTransport;
        this.data = {};
    }
}
export class CreateConsumerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.createConsumerTransport;
        this.data = {};
    }
}
export class ConsumerTransportCreatedMsg {
    constructor() {
        this.type = payloadTypeServer.consumerTransportCreated;
        this.data = {};
    }
}
export class ConnectConsumerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.connectConsumerTransport;
        this.data = {};
    }
}
//creates a new room token
export class RoomNewMsg {
    constructor() {
        this.type = payloadTypeClient.roomNew;
        this.data = {
            roomConfig: new RoomConfig()
        };
    }
}
export class AuthUserNewTokenMsg {
    constructor() {
        this.type = payloadTypeClient.authUserNewToken;
        this.data = {};
    }
}
export class AuthUserNewTokenResultMsg {
    constructor() {
        this.type = payloadTypeServer.authUserNewTokenResult;
        this.data = {};
    }
}
export class RoomNewTokenMsg {
    constructor() {
        this.type = payloadTypeClient.roomNewToken;
        this.data = {};
    }
}
export class RoomNewTokenResultMsg {
    constructor() {
        this.type = payloadTypeClient.roomNewTokenResult;
        this.data = {};
    }
}
export class RoomNewResultMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewResult;
        this.data = {};
    }
}
export class RoomJoinMsg {
    constructor() {
        this.type = payloadTypeClient.roomJoin;
        this.data = {};
    }
}
export class RoomLeaveMsg {
    constructor() {
        this.type = payloadTypeClient.roomLeave;
        this.data = {};
    }
}
export class RoomLeaveResult {
    constructor() {
        this.type = payloadTypeServer.roomLeaveResult;
        this.data = {};
    }
}
export class RoomJoinResultMsg {
    constructor() {
        this.type = payloadTypeServer.roomJoinResult;
        this.data = { peers: [] };
    }
}
export class RoomNewPeerMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewPeer;
        this.data = {};
    }
}
export class RoomPeerLeftMsg {
    constructor() {
        this.type = payloadTypeServer.roomPeerLeft;
        this.data = {};
    }
}
export class RoomNewProducerMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewProducer;
        this.data = {};
    }
}
export class RoomTerminateMsg {
    constructor() {
        this.type = payloadTypeClient.roomTerminate;
        this.data = {};
    }
}
export class RoomTerminateResultMsg {
    constructor() {
        this.type = payloadTypeClient.roomTerminateResult;
        this.data = {};
    }
}
export class ProduceMsg {
    constructor() {
        this.type = payloadTypeClient.produce;
        this.data = {};
    }
}
export class ProducedMsg {
    constructor() {
        this.type = payloadTypeServer.produced;
        this.data = {};
    }
}
export class ConsumeMsg {
    constructor() {
        this.type = payloadTypeClient.consume;
        this.data = {};
    }
}
export class ConsumedMsg {
    constructor() {
        this.type = payloadTypeServer.consumed;
        this.data = {};
    }
}
export class UnauthorizedMsg {
    constructor() {
        this.type = payloadTypeServer.unauthorized;
        this.data = {};
    }
}
export var RoomServerAPIRoutes;
(function (RoomServerAPIRoutes) {
    RoomServerAPIRoutes["newAuthUserToken"] = "/newAuthUserToken";
    RoomServerAPIRoutes["newRoomToken"] = "/newRoomToken";
    RoomServerAPIRoutes["newRoom"] = "/newRoom";
    RoomServerAPIRoutes["terminateRoom"] = "/terminateRoom";
})(RoomServerAPIRoutes || (RoomServerAPIRoutes = {}));
export class RoomConfig {
    constructor() {
        this.maxPeers = 2;
        this.newRoomTokenExpiresInMinutes = 30; //room token expiration from date created
        this.maxRoomDurationMinutes = 30; // room max duration, starts when the room is created
        this.timeOutNoParticipantsSecs = 5 * 60; //when no participants in the room, timer starts and will close the room 
    }
}
