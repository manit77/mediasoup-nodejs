
export enum RecordingAPIRoutes {
    recReady = "/recReady",
    recDone = "/recDone",
    recRoomNew = "/recRoomNew",
    recRoomTerminate = "/recRoomTerminate",
    recRoomProduceStream = "/recRoomProduceStream"
}


export enum RecMsgTypes {
    recRoomNew = "recRoomNew",
    recRoomTerminmate = "recRoomTerminmate",
    recRoomProduceStream = "recRoomProduceStream",
}

export interface RecRoomNewMsg {
    type: RecMsgTypes.recRoomNew,
    data: {
        roomId: string,
        roomTrackingId: string,
        roomCallBackURI: string,
    }
}
export interface RecRoomTerminateMsg {
    type: RecMsgTypes.recRoomTerminmate,
    data: {
        roomId: string
    }
}

export interface RecRoomProduceStreamMsg {
    type: RecMsgTypes.recRoomProduceStream,
    data: {
        roomId: string;
        peerId: string;
        producerId: string;
        peerTrackingId: string;
        roomTrackingId: string;
        kind: "audio" | "video";
        joinInstanceId: string;
    }
}
