import { apiGetClientConfigPost, apiGetParticipantsOnlinePost, apiGetScheduledConferencePost, apiGetScheduledConferencesPost, 
    GetClientConfigResultMsg, GetConferenceScheduledResultMsg, GetConferencesScheduledResultMsg, GetParticipantsResultMsg, 
    IMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
import { ConferenceClientConfig } from './models.js';

export class ConferenceAPIClient {

    constructor(private config: ConferenceClientConfig) {

    }

    startFetchConferencesScheduledTimerId = null;

    login = async (username: string, password: string, clientData: {}): Promise<LoginResultMsg> => {
        console.log(`login ${username} `, clientData);
        if (!username.trim()) {
            throw new Error('username name cannot be empty.');
        }
        if (!password.trim()) {
            throw new Error('password name cannot be empty.');
        }
        const postMsg = new LoginMsg();
        postMsg.data.username = username;
        postMsg.data.password = password;
        postMsg.data.clientData = clientData;
        return this._post<LoginResultMsg>(WebRoutes.login, postMsg);
    };

    loginGuest = async (username: string, password: string, clientData: {}): Promise<LoginResultMsg> => {
        console.log(`loginGuest ${username}`);
        try {
            if (!username.trim()) {
                throw new Error('username name cannot be empty.');
            }
            if (!password.trim()) {
                throw new Error('password name cannot be empty.');
            }
            const postMsg = new LoginGuestMsg();
            postMsg.data.username = username;
            postMsg.data.password = password;
            postMsg.data.clientData = clientData;
            return await this._post<LoginResultMsg>(WebRoutes.loginGuest, postMsg);
        } catch (err) {
            console.error(err);
            return { error: err.message } as LoginResultMsg;
        }
    };

    getConferencesScheduled = async (authToken: string, clientData: {}): Promise<GetConferencesScheduledResultMsg> => {
        console.log("getConferencesScheduled", clientData);
        const post = new apiGetScheduledConferencesPost();
        post.data.clientData = clientData;
        return this._post<GetConferencesScheduledResultMsg>(WebRoutes.getConferencesScheduled, post, authToken);
    };

    getConferenceScheduled = async (authToken: string, trackingId: string, clientData: {}): Promise<GetConferenceScheduledResultMsg> => {
        console.log(`getConferenceScheduled ${trackingId} `, clientData);
        const post = new apiGetScheduledConferencePost();
        post.data.id = trackingId;
        post.data.clientData = clientData;
        return this._post<GetConferenceScheduledResultMsg>(WebRoutes.getConferenceScheduled, post, authToken);
    };

    getParticipantsOnline = async (authToken: string, username: string, clientData: {}): Promise<GetParticipantsResultMsg> => {
        console.log("getParticipantsOnline", clientData);
        const post = new apiGetParticipantsOnlinePost();
        post.data.username = username;
        post.data.clientData = clientData;
        return this._post<GetParticipantsResultMsg>(WebRoutes.getParticipantsOnline, post, authToken);
    };

    getClientConfig = async (clientData: {}): Promise<GetClientConfigResultMsg> => {
        console.log("getClientConfig", clientData);
        const post = new apiGetClientConfigPost();
        post.data.clientData = clientData;
        return this._post<GetClientConfigResultMsg>(WebRoutes.getClientConfig, post);
    };

    private async _post<T extends IMsg>(path: string, body: IMsg, authToken?: string): Promise<T> {
        try {
            const headers: HeadersInit = { 'Content-Type': 'application/json' };
            if (authToken) {
                headers['Authorization'] = `Bearer ${authToken}`;
            }
            const response = await fetch(`${this.config.conf_server_url}${path}`, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(body),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed with status ${response.status}: ${errorText}`);
            }

            return await response.json() as T;
        } catch (err) {
            console.error(err);
            // Return a message object with an error property to maintain type consistency
            return { error: err.message } as T;
        }
    }
};
