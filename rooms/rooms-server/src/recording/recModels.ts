
export enum RecordingAPIRoutes {
    recAgentStatus = "/recAgentStatus",
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
    recFailed = "recFailed",
    recMixFailed = "recMixFailed",
    recMixDone = "recMixDone",
    recRoomStatus = "recRoomStatus",
    recPacketRecorded = "recPacketRecorded",
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


export interface RecCallBackMsg {
    type: RecMsgTypes,
    data: {

        roomId: string;

        instanceId?: string;
        kind?: string;
        recIP?: string;
        recPort?: number;

        peerId?: string;
        producerId?: string;
        joinInstanceId?: string;
    }
}

export interface RecPacketRecordedMsg {
    type: RecMsgTypes.recPacketRecorded,
    data: {
        roomId: string,
        peerId: string,
        kind: string,
    }
}