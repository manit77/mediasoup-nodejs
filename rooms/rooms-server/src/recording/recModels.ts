
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
    recReady = "recReady",
    recDone = "recDone",
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
        codec: {
            /**
            * The codec MIME media type/subtype (e.g. 'audio/opus', 'video/VP8').
            */
            mimeType: string;
            /**
             * The value that goes in the RTP Payload Type Field. Must be unique.
             */
            payloadType: number;
            /**
             * Codec clock rate expressed in Hertz.
             */
            clockRate: number;
            /**
             * The number of channels supported (e.g. two for stereo). Just for audio.
             * Default 1.
             */
            channels?: number;
            /**
             * Codec-specific parameters available for signaling. Some parameters (such
             * as 'packetization-mode' and 'profile-level-id' in H264 or 'profile-id' in
             * VP9) are critical for codec matching.
             */
            parameters?: any;
            /**
             * Transport layer and codec-specific feedback messages for this codec.
             */
            rtcpFeedback?: any[];
        }

    }
}


export interface RecReadyMsg {
    type: RecMsgTypes.recReady,
    data: {

        instanceId: string;
        kind: string;
        recIP: string;
        recPort: number;

        roomId: string;
        peerId: string;
        producerId: string;
        joinInstanceId: string;
    }
}