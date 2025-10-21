import axios from "axios"
import https from "https"
import { RecordingAPIRoutes, RecRoomNewMsg, RecRoomProduceStreamMsg, RecRoomTerminateMsg } from "./recModels.js";

export async function recRoomNew(recURI: string, msg: RecRoomNewMsg) {
    let url = `${recURI}${RecordingAPIRoutes.recRoomNew}`
    return await recPost(url, msg);
}

export async function recRoomTerminate(recURI: string, msg: RecRoomTerminateMsg) {
    let url = `${recURI}${RecordingAPIRoutes.recRoomTerminate}`
    return await recPost(url, msg);
}

export async function recRoomProduceStream(recURI: string, msg: RecRoomProduceStreamMsg) {
    let url = `${recURI}${RecordingAPIRoutes.recRoomProduceStream}`
    return await recPost(url, msg);
}

async function recPost(url: string, dataObj: any): Promise<any> {
    console.log(`recPost: ${url}`);

    try {

        const agent = new https.Agent({ rejectUnauthorized: false }); // Use only in development
        const options = {
            headers: {
                'Content-Type': 'application/json',
                //'Authorization': `Bearer ${this.config.accessToken}`
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
        console.error(`POST error: ${url}`);
        console.error(`POST error: ${err.message}`);        
        return null;
    }
}
