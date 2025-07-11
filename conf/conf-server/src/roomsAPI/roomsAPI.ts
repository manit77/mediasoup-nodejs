import axios from "axios";
import {
    RoomNewMsg, AuthUserNewTokenMsg, AuthUserNewTokenResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg
    , RoomServerAPIRoutes, RoomTerminateMsg, RoomConfig,
    RoomLeaveMsg,
    RoomLeaveResultMsg,
    RoomNewResultMsg
} from "@rooms/rooms-models";
import https from "https"

export class RoomsAPI {

    /**
     * rooms socket server 
     */
    config = {
        apiURI: "https://localhost:3000",
        accessToken: ""
    }

    constructor(uri: string, accessToken: string) {
        if (uri) {
            this.config.apiURI = uri;
        }
        if (accessToken) {
            this.config.accessToken = accessToken;
        }
    }

    async newRoomToken(): Promise<RoomNewTokenResultMsg> {
        let msgIn = new RoomNewTokenMsg();
        return await this.post(RoomServerAPIRoutes.newRoomToken, msgIn) as RoomNewTokenResultMsg;
    }

    async newAuthUserToken() {
        let msgIn = new AuthUserNewTokenMsg();
        return await this.post(RoomServerAPIRoutes.newAuthUserToken, msgIn) as AuthUserNewTokenResultMsg;
    }

    async newRoom(roomId: string, roomToken: string, roomName: string, trackingId: string, config: RoomConfig) {
        let msgIn = new RoomNewMsg();
        msgIn.data.roomId = roomId;
        msgIn.data.roomToken = roomToken;
        msgIn.data.roomName = roomName;
        msgIn.data.trackingId = trackingId;
        msgIn.data.roomConfig = config;

        return await this.post(RoomServerAPIRoutes.newRoom, msgIn) as RoomNewResultMsg;
    }

    async leaveRoom(roomId: string, peerId: string) {
        let msgIn = new RoomLeaveMsg();
        msgIn.data.roomId = roomId;
        msgIn.data.peerId = peerId;
        return await this.post(RoomServerAPIRoutes.newRoom, msgIn) as RoomLeaveResultMsg;
    }

    async terminateRoom(roomId: string) {
        let msgIn = new RoomTerminateMsg();
        msgIn.data.roomId = roomId;
        return await this.post(RoomServerAPIRoutes.terminateRoom, msgIn);
    }

    private async post(path: string, dataObj: any): Promise<any> {
        const url = `${this.config.apiURI}${path}`;
        console.log(`POST: ${url}`);

        const agent = new https.Agent({ rejectUnauthorized: false }); // Use only in development
        const options = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.accessToken}`
            },
            httpsAgent: agent,
        };

        try {
            console.log(`POST: ${url}, Data:`, dataObj);
            const result = await axios.post(url, dataObj, options); // Pass dataObj directly
            if (result.status >= 200 && result.status < 300) { // Handle all 2xx status codes
                return result.data;
            }
            console.log(`Unexpected status code: ${result.status}`);
            return null;
        } catch (err) {
            console.error(`POST error: ${err.message}`);
            return null;
        }
    }


}