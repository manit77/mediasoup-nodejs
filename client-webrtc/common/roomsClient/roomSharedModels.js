"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumedMsg = exports.ConsumeMsg = exports.ProducedMsg = exports.ProduceMsg = exports.RoomTerminateMsg = exports.RoomNewProducerMsg = exports.RoomPeerLeftMsg = exports.RoomNewPeerMsg = exports.RoomJoinResultMsg = exports.RoomLeaveMsg = exports.RoomJoinMsg = exports.RoomNewResultMsg = exports.RoomNewTokenResultMsg = exports.RoomNewTokenMsg = exports.RoomNewMsg = exports.ConnectConsumerTransportMsg = exports.ConsumerTransportCreatedMsg = exports.CreateConsumerTransportMsg = exports.ConnectProducerTransportMsg = exports.ProducerTransportCreatedMsg = exports.CreateProducerTransportMsg = exports.TerminatePeerMsg = exports.RegisterResultMsg = exports.RegisterMsg = exports.payloadTypeServer = exports.payloadTypeClient = void 0;
/**
 * server receives these payload types
 */
var payloadTypeClient;
(function (payloadTypeClient) {
    payloadTypeClient["register"] = "register";
    payloadTypeClient["terminatePeer"] = "terminatePeer";
    payloadTypeClient["createProducerTransport"] = "createProducerTransport";
    payloadTypeClient["createConsumerTransport"] = "createConsumerTransport";
    payloadTypeClient["connectProducerTransport"] = "connectProducerTransport";
    payloadTypeClient["connectConsumerTransport"] = "connectConsumerTransport";
    payloadTypeClient["roomNewToken"] = "roomNewToken";
    payloadTypeClient["roomNew"] = "roomNew";
    payloadTypeClient["roomNewResult"] = "roomNewResult";
    payloadTypeClient["roomJoin"] = "roomJoin";
    payloadTypeClient["roomLeave"] = "roomLeave";
    payloadTypeClient["roomTerminate"] = "roomTerminate";
    payloadTypeClient["produce"] = "produce";
    payloadTypeClient["consume"] = "consume";
})(payloadTypeClient || (exports.payloadTypeClient = payloadTypeClient = {}));
/**
 * server sends these payload types
 */
var payloadTypeServer;
(function (payloadTypeServer) {
    payloadTypeServer["registerResult"] = "registerResult";
    payloadTypeServer["producerTransportCreated"] = "producerTransportCreated";
    payloadTypeServer["consumerTransportCreated"] = "consumerTransportCreated";
    payloadTypeServer["produced"] = "produced";
    payloadTypeServer["consumed"] = "consumed";
    payloadTypeServer["roomJoinResult"] = "roomJoinResult";
    payloadTypeServer["roomNewPeer"] = "roomNewPeer";
    payloadTypeServer["roomNewProducer"] = "roomNewProducer";
    payloadTypeServer["roomPeerLeft"] = "roomPeerLeft";
})(payloadTypeServer || (exports.payloadTypeServer = payloadTypeServer = {}));
class RegisterMsg {
    constructor() {
        this.type = payloadTypeClient.register;
        this.data = {};
    }
}
exports.RegisterMsg = RegisterMsg;
class RegisterResultMsg {
    constructor() {
        this.type = payloadTypeServer.registerResult;
        this.data = {};
    }
}
exports.RegisterResultMsg = RegisterResultMsg;
class TerminatePeerMsg {
    constructor() {
        this.type = payloadTypeClient.terminatePeer;
        this.data = {};
    }
}
exports.TerminatePeerMsg = TerminatePeerMsg;
class CreateProducerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.createProducerTransport;
    }
}
exports.CreateProducerTransportMsg = CreateProducerTransportMsg;
class ProducerTransportCreatedMsg {
    constructor() {
        this.type = payloadTypeServer.producerTransportCreated;
        this.data = {};
    }
}
exports.ProducerTransportCreatedMsg = ProducerTransportCreatedMsg;
class ConnectProducerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.connectProducerTransport;
        this.data = {};
    }
}
exports.ConnectProducerTransportMsg = ConnectProducerTransportMsg;
class CreateConsumerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.createConsumerTransport;
    }
}
exports.CreateConsumerTransportMsg = CreateConsumerTransportMsg;
class ConsumerTransportCreatedMsg {
    constructor() {
        this.type = payloadTypeServer.consumerTransportCreated;
        this.data = {};
    }
}
exports.ConsumerTransportCreatedMsg = ConsumerTransportCreatedMsg;
class ConnectConsumerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.connectConsumerTransport;
        this.data = {};
    }
}
exports.ConnectConsumerTransportMsg = ConnectConsumerTransportMsg;
//creates a new room token
class RoomNewMsg {
    constructor() {
        this.type = payloadTypeClient.roomNew;
        this.data = {};
    }
}
exports.RoomNewMsg = RoomNewMsg;
class RoomNewTokenMsg {
    constructor() {
        this.type = payloadTypeClient.roomNew;
        this.data = {};
    }
}
exports.RoomNewTokenMsg = RoomNewTokenMsg;
class RoomNewTokenResultMsg {
    constructor() {
        this.type = payloadTypeClient.roomNew;
        this.data = {};
    }
}
exports.RoomNewTokenResultMsg = RoomNewTokenResultMsg;
class RoomNewResultMsg {
    constructor() {
        this.type = payloadTypeClient.roomNewResult;
        this.data = {};
    }
}
exports.RoomNewResultMsg = RoomNewResultMsg;
class RoomJoinMsg {
    constructor() {
        this.type = payloadTypeClient.roomJoin;
        this.data = {};
    }
}
exports.RoomJoinMsg = RoomJoinMsg;
class RoomLeaveMsg {
    constructor() {
        this.type = payloadTypeClient.roomLeave;
        this.data = {};
    }
}
exports.RoomLeaveMsg = RoomLeaveMsg;
class RoomJoinResultMsg {
    constructor() {
        this.type = payloadTypeServer.roomJoinResult;
        this.data = { peers: [] };
    }
}
exports.RoomJoinResultMsg = RoomJoinResultMsg;
class RoomNewPeerMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewPeer;
        this.data = {};
    }
}
exports.RoomNewPeerMsg = RoomNewPeerMsg;
class RoomPeerLeftMsg {
    constructor() {
        this.type = payloadTypeServer.roomPeerLeft;
        this.data = {};
    }
}
exports.RoomPeerLeftMsg = RoomPeerLeftMsg;
class RoomNewProducerMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewProducer;
        this.data = {};
    }
}
exports.RoomNewProducerMsg = RoomNewProducerMsg;
class RoomTerminateMsg {
    constructor() {
        this.type = payloadTypeClient.roomTerminate;
        this.data = {};
    }
}
exports.RoomTerminateMsg = RoomTerminateMsg;
class ProduceMsg {
    constructor() {
        this.type = payloadTypeClient.produce;
        this.data = {};
    }
}
exports.ProduceMsg = ProduceMsg;
class ProducedMsg {
    constructor() {
        this.type = payloadTypeServer.produced;
        this.data = {};
    }
}
exports.ProducedMsg = ProducedMsg;
class ConsumeMsg {
    constructor() {
        this.type = payloadTypeClient.consume;
        this.data = {};
    }
}
exports.ConsumeMsg = ConsumeMsg;
class ConsumedMsg {
    constructor() {
        this.type = payloadTypeServer.consumed;
        this.data = {};
    }
}
exports.ConsumedMsg = ConsumedMsg;
