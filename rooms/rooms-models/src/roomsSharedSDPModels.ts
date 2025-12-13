import { BaseMsg, IMsg, payloadTypeClient, payloadTypeServer } from "./roomsSharedModels.js";

export const payloadTypeSDP = {
    
    roomOfferSDP : "roomOfferSDP",
    roomOfferSDPResult : "roomOfferSDPResult",

    roomAnswerSDP : "roomAnswerSDP",
    roomAnswerSDPResult : "roomAnswerSDPResult",
    
    roomConsumeSDP: "roomConsumeSDP",
    roomConsumeSDPResult: "roomConsumeSDPResult",
    roomNewProducerSDP: "roomNewProducerSDP",    
}

export class RoomOfferSDPMsg implements IMsg {
    type = payloadTypeSDP.roomOfferSDP;
    data: {
        roomId?: string,
        offer?: any,
    } = {}
}

export class RoomAnswerSDPMsg implements IMsg {
    type = payloadTypeSDP.roomAnswerSDP;
    data: {
        roomId?: string,
        answer?: any,
    } = {}
}

export class RoomOfferSDPResultMsg implements IMsg {
    type = payloadTypeSDP.roomOfferSDPResult;
    data: {
        roomId?: string,
        answer?: any,
    } = {}
}

export class RoomNewProducerSDPMsg extends BaseMsg {
    type = payloadTypeSDP.roomNewProducerSDP;
    data: {
        roomId?: string,
        peerId?: string,      
    } = {};
}

export class RoomConsumeSDPMsg extends BaseMsg {
    type = payloadTypeSDP.roomConsumeSDP;
    data: {
        roomId?: string,
        remotePeerId?: string        
    } = {};
}

export class RoomConsumeSDPResultMsg extends BaseMsg {
    type = payloadTypeSDP.roomConsumeSDPResult;
    data: {
        roomId?: string,        
        offer?: string,
        remotePeerId?: string
    } = {};
}