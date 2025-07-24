import axios from "axios";
import https from "https"
import { ConferenceServerConfig } from "../confServer/conferenceServer.js";
import { apiGetScheduledConferenceResult, apiGetScheduledConferencesResult, apiLoginResult, apiScheduledConference } from "@conf/conf-models";

export class ThirdPartyAPI {

    constructor(private config: ConferenceServerConfig) {

    }

    async login(username: string, password: string, authToken: string, clientData: {}) {
        let postData = { username: username, password: password, authToken: authToken, clientData: clientData };
        return await this.post(this.config.conf_data_urls.loginURL, postData) as apiLoginResult;
    }

    async getScheduledConferences(clientData: any) {
        let postData = { clientData: clientData };
        return await this.post(this.config.conf_data_urls.getScheduledConferencesURL, postData) as apiGetScheduledConferencesResult;
    }

    async getScheduledConference(id: string, clientData: any) {
        let postData = { id: id, clientData: clientData };
        return await this.post(this.config.conf_data_urls.getScheduledConferenceURL, postData) as apiGetScheduledConferenceResult;
    }

    private async post(url: string, dataObj?: any): Promise<any> {
        console.log(`POST: ${url}`);

        const agent = new https.Agent({ rejectUnauthorized: false }); // Use only in development
        let options: any;

        if (this.config.conf_data_access_token) {
            options = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.config.conf_data_access_token}`
                },
                httpsAgent: agent,
            };
        }

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