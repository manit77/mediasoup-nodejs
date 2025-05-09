"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsumedMsg = exports.ConsumeMsg = exports.ProducedMsg = exports.ProduceMsg = exports.RoomNewProducerMsg = exports.RoomNewPeerMsg = exports.RoomJoinResultMsg = exports.RoomJoinMsg = exports.ConnectConsumerTransportMsg = exports.ConsumerTransportCreatedMsg = exports.CreateConsumerTransportMsg = exports.ConnectProducerTransportMsg = exports.ProducerTransportCreatedMsg = exports.CreateProducerTransportMsg = exports.RegisterResultMsg = exports.RegisterMsg = exports.payloadTypeServer = exports.payloadTypeClient = void 0;
/**
 * server receives these payload types
 */
var payloadTypeClient;
(function (payloadTypeClient) {
    payloadTypeClient["register"] = "register";
    payloadTypeClient["createProducerTransport"] = "createProducerTransport";
    payloadTypeClient["createConsumerTransport"] = "createConsumerTransport";
    payloadTypeClient["connectProducerTransport"] = "connectProducerTransport";
    payloadTypeClient["connectConsumerTransport"] = "connectConsumerTransport";
    payloadTypeClient["roomJoin"] = "roomJoin";
    payloadTypeClient["roomLeave"] = "roomLeave";
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
})(payloadTypeServer || (exports.payloadTypeServer = payloadTypeServer = {}));
class RegisterMsg {
    constructor() {
        this.type = payloadTypeClient.register;
        this.authToken = "";
        this.displayName = "";
    }
}
exports.RegisterMsg = RegisterMsg;
class RegisterResultMsg {
    constructor() {
        this.type = payloadTypeServer.registerResult;
    }
}
exports.RegisterResultMsg = RegisterResultMsg;
class CreateProducerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.createProducerTransport;
    }
}
exports.CreateProducerTransportMsg = CreateProducerTransportMsg;
class ProducerTransportCreatedMsg {
    constructor() {
        this.type = payloadTypeServer.producerTransportCreated;
    }
}
exports.ProducerTransportCreatedMsg = ProducerTransportCreatedMsg;
class ConnectProducerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.connectProducerTransport;
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
    }
}
exports.ConsumerTransportCreatedMsg = ConsumerTransportCreatedMsg;
class ConnectConsumerTransportMsg {
    constructor() {
        this.type = payloadTypeClient.connectConsumerTransport;
    }
}
exports.ConnectConsumerTransportMsg = ConnectConsumerTransportMsg;
class RoomJoinMsg {
    constructor() {
        this.type = payloadTypeClient.roomJoin;
    }
}
exports.RoomJoinMsg = RoomJoinMsg;
class RoomJoinResultMsg {
    constructor() {
        this.type = payloadTypeServer.roomJoinResult;
    }
}
exports.RoomJoinResultMsg = RoomJoinResultMsg;
class RoomNewPeerMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewPeer;
    }
}
exports.RoomNewPeerMsg = RoomNewPeerMsg;
class RoomNewProducerMsg {
    constructor() {
        this.type = payloadTypeServer.roomNewProducer;
    }
}
exports.RoomNewProducerMsg = RoomNewProducerMsg;
class ProduceMsg {
    constructor() {
        this.type = payloadTypeClient.produce;
    }
}
exports.ProduceMsg = ProduceMsg;
class ProducedMsg {
    constructor() {
        this.type = payloadTypeServer.produced;
    }
}
exports.ProducedMsg = ProducedMsg;
class ConsumeMsg {
    constructor() {
        this.action = payloadTypeClient.consume;
    }
}
exports.ConsumeMsg = ConsumeMsg;
class ConsumedMsg {
    constructor() {
        this.action = payloadTypeServer.consumed;
    }
}
exports.ConsumedMsg = ConsumedMsg;
