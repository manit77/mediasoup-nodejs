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
    payloadTypeServer["roomTerminateResult"] = "roomTerminateResult";
    payloadTypeServer["roomClosed"] = "roomClosed";
    payloadTypeServer["peerTerminated"] = "peerTerminated";
    payloadTypeServer["error"] = "error";
    payloadTypeServer["ok"] = "ok";
})(payloadTypeServer || (payloadTypeServer = {}));
export class ErrorMsg {
    type = payloadTypeServer.error;
    data = {
        error: ""
    };
    constructor(error) {
        this.data.error = error;
    }
}
export class OkMsg {
    type = payloadTypeServer.ok;
    data = {
        payload: ""
    };
    constructor(payload) {
        this.data.payload = payload;
    }
}
export class RegisterPeerMsg {
    type = payloadTypeClient.registerPeer;
    data = {};
}
export class RegisterPeerResultMsg {
    type = payloadTypeServer.registerPeerResult;
    data = {};
}
export class TerminatePeerMsg {
    type = payloadTypeClient.terminatePeer;
    data = {};
}
export class PeerTerminatedMsg {
    type = payloadTypeServer.peerTerminated;
    data = {};
}
export class CreateProducerTransportMsg {
    type = payloadTypeClient.createProducerTransport;
    data = {};
}
export class ProducerTransportCreatedMsg {
    type = payloadTypeServer.producerTransportCreated;
    data = {};
}
export class ConnectProducerTransportMsg {
    type = payloadTypeClient.connectProducerTransport;
    data = {};
}
export class CreateConsumerTransportMsg {
    type = payloadTypeClient.createConsumerTransport;
    data = {};
}
export class ConsumerTransportCreatedMsg {
    type = payloadTypeServer.consumerTransportCreated;
    data = {};
}
export class ConnectConsumerTransportMsg {
    type = payloadTypeClient.connectConsumerTransport;
    data = {};
}
//creates a new room token
export class RoomNewMsg {
    type = payloadTypeClient.roomNew;
    data = {
        roomConfig: new RoomConfig()
    };
}
export class AuthUserNewTokenMsg {
    type = payloadTypeClient.authUserNewToken;
    data = {};
}
export class AuthUserNewTokenResultMsg {
    type = payloadTypeServer.authUserNewTokenResult;
    data = {};
}
export class RoomNewTokenMsg {
    type = payloadTypeClient.roomNewToken;
    data = {};
}
export class RoomNewTokenResultMsg {
    type = payloadTypeClient.roomNewTokenResult;
    data = {};
}
export class RoomNewResultMsg {
    type = payloadTypeServer.roomNewResult;
    data = {};
}
export class RoomJoinMsg {
    type = payloadTypeClient.roomJoin;
    data = {};
}
export class RoomLeaveMsg {
    type = payloadTypeClient.roomLeave;
    data = {};
}
export class RoomLeaveResult {
    type = payloadTypeServer.roomLeaveResult;
    data = {};
}
export class RoomClosedMsg {
    type = payloadTypeServer.roomClosed;
    data = {};
}
export class RoomJoinResultMsg {
    type = payloadTypeServer.roomJoinResult;
    data = { peers: [] };
}
export class RoomNewPeerMsg {
    type = payloadTypeServer.roomNewPeer;
    data = {};
}
export class RoomPeerLeftMsg {
    type = payloadTypeServer.roomPeerLeft;
    data = {};
}
export class RoomNewProducerMsg {
    type = payloadTypeServer.roomNewProducer;
    data = {};
}
export class RoomTerminateMsg {
    type = payloadTypeClient.roomTerminate;
    data = {};
}
export class RoomTerminateResultMsg {
    type = payloadTypeServer.roomTerminateResult;
    data = {};
}
export class ProduceMsg {
    type = payloadTypeClient.produce;
    data = {};
}
export class ProducedMsg {
    type = payloadTypeServer.produced;
    data = {};
}
export class ConsumeMsg {
    type = payloadTypeClient.consume;
    data = {};
}
export class ConsumedMsg {
    type = payloadTypeServer.consumed;
    data = {};
}
export class UnauthorizedMsg {
    type = payloadTypeServer.unauthorized;
    data = {};
}
export var RoomServerAPIRoutes;
(function (RoomServerAPIRoutes) {
    RoomServerAPIRoutes["newAuthUserToken"] = "/newAuthUserToken";
    RoomServerAPIRoutes["newRoomToken"] = "/newRoomToken";
    RoomServerAPIRoutes["newRoom"] = "/newRoom";
    RoomServerAPIRoutes["terminateRoom"] = "/terminateRoom";
})(RoomServerAPIRoutes || (RoomServerAPIRoutes = {}));
export class RoomConfig {
    maxPeers = 2;
    newRoomTokenExpiresInMinutes = 30; //room token expiration from date created
    maxRoomDurationMinutes = 30; // room max duration, starts when the room is created
    timeOutNoParticipantsSecs = 5 * 60; //when no participants in the room, timer starts and will close the room 
}
//# sourceMappingURL=roomsSharedModels.js.map