import axios from "axios";
import {
    RoomNewMsg, AuthUserNewTokenMsg, AuthUserNewTokenResultMsg, RoomNewTokenMsg, RoomNewTokenResultMsg
    , RoomServerAPIRoutes, RoomTerminateMsg, RoomConfig,
    RoomLeaveMsg,
    RoomLeaveResultMsg,
    RoomNewResultMsg,
    AuthUserRoles,
    RoomPongMsg,
    IMsg,
    RoomGetStatusResultMsg,
    RoomGetStatusMsg,
    RoomGetAccessTokenMsg,
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
        let msgOut = new RoomNewTokenMsg();
        return await this.post(RoomServerAPIRoutes.newRoomToken, msgOut) as RoomNewTokenResultMsg;
    }

    async newAuthUserToken(username: string, role: AuthUserRoles) {
        let msgOut = new AuthUserNewTokenMsg();
        msgOut.data.username = username;
        msgOut.data.expiresInMin = 0;
        msgOut.data.role = role;        
        return await this.post(RoomServerAPIRoutes.newAuthUserToken, msgOut) as AuthUserNewTokenResultMsg;
    }

    async newRoom(roomId: string, roomToken: string, roomName: string, trackingId: string, config: RoomConfig) {
        let msgOut = new RoomNewMsg();
        msgOut.data.roomId = roomId;
        msgOut.data.roomToken = roomToken;
        msgOut.data.roomName = roomName;
        msgOut.data.roomTrackingId = trackingId;
        msgOut.data.roomConfig = config;
        return await this.post(RoomServerAPIRoutes.newRoom, msgOut) as RoomNewResultMsg;
    }

    async getRoomAccessToken(roomId: string, peerTrackingId: string): Promise<RoomNewTokenResultMsg> {
        let msgOut = new RoomGetAccessTokenMsg();
        msgOut.data.roomId = roomId;
        msgOut.data.peerTrackingId = peerTrackingId;
        return await this.post(RoomServerAPIRoutes.getRoomAccessToken, msgOut) as RoomNewTokenResultMsg;
    }

    async leaveRoom(roomId: string, peerId: string) {
        let msgOut = new RoomLeaveMsg();
        msgOut.data.roomId = roomId;
        msgOut.data.peerId = peerId;
        return await this.post(RoomServerAPIRoutes.newRoom, msgOut) as RoomLeaveResultMsg;
    }

    async terminateRoom(roomId: string) {
        let msgOut = new RoomTerminateMsg();
        msgOut.data.roomId = roomId;
        return await this.post(RoomServerAPIRoutes.terminateRoom, msgOut);
    }

    async roomPong(roomId: string, peerTrackingId: string) : Promise<IMsg> {
        let msgOut = new RoomPongMsg();
        msgOut.data.roomId = roomId;
        msgOut.data.peerTrackingId = peerTrackingId;
        return await this.post(RoomServerAPIRoutes.roomPong, msgOut);
    }

    async getRoomStatus(roomId: string) : Promise<IMsg> {
        let msgOut = new RoomGetStatusMsg();
        msgOut.data.roomId = roomId;
        return await this.post(RoomServerAPIRoutes.getRoomStatus, msgOut);
    }        

    private async post(path: string, dataObj: any): Promise<any> {
        const url = `${this.config.apiURI}${path}`;
        console.log(`POST: ${url}`);

        try {

            const agent = new https.Agent({ rejectUnauthorized: false }); // Use only in development
            const options = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.accessToken}`
                },
                httpsAgent: agent,
            };

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