import axios from "axios";
import https from "https"
import { ConferenceServerConfig } from "../confServer/models.js";
import { apiGetClientConfigPost, apiGetScheduledConferencePost, apiGetScheduledConferenceResult, apiGetScheduledConferencesPost, apiGetScheduledConferencesResult, apiLoginPost, apiLoginResult, apiMsgTypes, apiScheduledConference, createIMsg, IMsg } from "@conf/conf-models";

export class ThirdPartyAPI {

    constructor(private config: ConferenceServerConfig) {

    }

    async getUser(externalId: string, clientData: {}) {
        console.log('getUser', externalId);

        let postData = new apiLoginPost();
        postData.data.externalId = externalId;
        postData.data.clientData = clientData;
        return await this.post(this.config.conf_data_urls.get_user_url, postData) as apiLoginResult;
    }

    async login(username: string, password: string, clientData: {}) {
        console.log('login', username);

        let postData = new apiLoginPost();
        postData.data.username = username;
        postData.data.password = password;
        postData.data.clientData = clientData;
        return await this.post(this.config.conf_data_urls.login_url, postData) as apiLoginResult;
    }

    async loginGuest(username: string, password: string, clientData: {}) {
        console.log(`loginGuest`, clientData);

        let postData = new apiLoginPost();
        postData.data.username = username;
        postData.data.password = password;
        postData.data.clientData = clientData;
        return await this.post(this.config.conf_data_urls.login_guest_url, postData) as apiLoginResult;
    }

    async getScheduledConferences(clientData: {}) {
        console.log(`getScheduledConferences`, clientData);

        let postData = new apiGetScheduledConferencesPost();
        postData.data.clientData = clientData;
        return await this.post(this.config.conf_data_urls.get_scheduled_conferences_url, postData) as apiGetScheduledConferencesResult;
    }

    async getScheduledConference(id: string, clientData: {}) {
        console.log(`getScheduledConference, clientData:`, clientData);

        let postData = new apiGetScheduledConferencesPost();
        postData.data.id = id;
        postData.data.clientData = clientData;
        return await this.post(this.config.conf_data_urls.get_scheduled_conference_url, postData) as apiGetScheduledConferenceResult;
    }

    async getClientConfig(clientData: {}): Promise<IMsg> {
        console.log(`getScheduledConference, clientData:`, clientData);

        let postData = new apiGetClientConfigPost();
        postData.data.clientData = clientData;
        return await this.post(this.config.conf_data_urls.get_client_config_url, postData);
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
            console.error(`POST error: ${err}`);
            return null;
        }
    }

}