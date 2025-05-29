import axios from "axios";
import { RoomNewMsg, AuthUserNewTokenMsg, RoomNewTokenMsg, RoomServerAPIRoutes, RoomTerminateMsg } from "@rooms/rooms-models";
import https from "https";
export class RoomsAPI {
    /**
     * rooms socket server
     */
    config = {
        apiURI: "https://localhost:3000"
    };
    constructor(uri) {
        if (uri) {
            this.config.apiURI = uri;
        }
    }
    async newRoomToken() {
        let msgIn = new RoomNewTokenMsg();
        return await this.post(RoomServerAPIRoutes.newRoomToken, msgIn);
    }
    async newAuthUserToken() {
        let msgIn = new AuthUserNewTokenMsg();
        return await this.post(RoomServerAPIRoutes.newAuthUserToken, msgIn);
    }
    async newRoom(roomId, roomToken, config) {
        let msgIn = new RoomNewMsg();
        msgIn.data.roomToken = roomToken;
        msgIn.data.roomId = roomId;
        msgIn.data.roomConfig = config;
        return await this.post(RoomServerAPIRoutes.newRoom, msgIn);
    }
    async terminateRoom(roomId) {
        let msgIn = new RoomTerminateMsg();
        msgIn.data.roomId = roomId;
        return await this.post(RoomServerAPIRoutes.terminateRoom, msgIn);
    }
    async post(path, dataObj) {
        const url = `${this.config.apiURI}${path}`;
        console.log(`POST: ${url}`);
        const agent = new https.Agent({ rejectUnauthorized: false }); // Use only in development
        const options = {
            headers: { 'Content-Type': 'application/json' },
            httpsAgent: agent,
        };
        try {
            console.log(`POST: ${url}, Data:`, dataObj);
            const result = await axios.post(url, dataObj, options); // Pass dataObj directly
            if (result.status >= 200 && result.status < 300) { // Handle all 2xx status codes
                return result.data;
            }
            console.warn(`Unexpected status code: ${result.status}`);
            return null;
        }
        catch (err) {
            console.error(`POST error: ${err.message}`);
            return null;
        }
    }
}
//# sourceMappingURL=roomsAPI.js.map