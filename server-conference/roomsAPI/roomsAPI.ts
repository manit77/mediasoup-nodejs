import axios from "axios";
import { RoomNewTokenMsg, RoomNewTokenResultMsg, RoomTerminateMsg } from "../../server-room/roomSharedModels";
import https from "https"
import { RoomNewMsg } from "../../client-room/roomSharedModels";

export class RoomsAPI {

    /**
     * rooms socket server 
     */
    config = {
        apiURI: "https://localhost:3000"
    }

    constructor(uri: string) {
        if (uri) {
            this.config.apiURI = uri;
        }
    }

    async newRoomToken(maxPeers: number) {
        let msgIn = new RoomNewTokenMsg();
        msgIn.data.maxPeers = maxPeers;
        return await this.post("/newRoomToken", msgIn) as RoomNewTokenResultMsg;
    }

    async newRoom(roomId: string, roomToken: string, maxPeers: number) {
        let msgIn = new RoomNewMsg();
        msgIn.data.maxPeers = maxPeers;
        msgIn.data.roomToken = roomToken;
        msgIn.data.roomId = roomId;
        
        return await this.post("/newRoom", msgIn) as RoomNewTokenResultMsg;
    }

    async terminateRoom(roomId: string) {
        let msgIn = new RoomTerminateMsg();
        msgIn.data.roomId = roomId;
        return await this.post("/terminateRoom", msgIn);
    }

    private async post(path: string, dataObj: any): Promise<any> {
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
        } catch (err) {
            console.error(`POST error: ${err.message}`);
            return null;
        }
    }


}