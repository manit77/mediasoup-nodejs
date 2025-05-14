import axios from "axios";
import { RoomNewTokenMsg, RoomNewTokenResultMsg, RoomTerminateMsg } from "../../server-room/roomSharedModels";

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

    async terminateRoom(roomId: string) {
        let msgIn = new RoomTerminateMsg();
        msgIn.data.roomId = roomId;
        return await this.post("/terminateRoom", msgIn);
    }

    private async post(path: string, dataObj: any): Promise<any> {
        var url = this.config.apiURI + path
        console.log("post, " + url);
        var options = { 'headers': { 'Content-Type': 'application/json' } };
        var payloadJsonString = JSON.stringify(dataObj);
        try {
            let result = await axios.post(url, payloadJsonString, options);
            if (result.status == 200) {
                return result.data;
            }
            return null;
        } catch (err) {
            console.error(err);
        }
        return null;
    }


}