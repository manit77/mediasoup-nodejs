import { apiGetScheduledConferencePost, apiGetScheduledConferencesPost, ConferenceScheduledInfo, GetConferenceScheduledResultMsg, GetConferencesScheduledResultMsg, LoginGuestMsg, LoginMsg, LoginResultMsg, WebRoutes } from '@conf/conf-models';
import { ConferenceClientConfig } from './models.js';

export class ConferenceAPIClient {

    constructor(private config: ConferenceClientConfig) {

    }

    startFetchConferencesScheduledTimerId = null;

    login = async (username: string, password: string, clientData: {}): Promise<LoginResultMsg> => {

        console.log(`login ${username}`);
        if (!username.trim()) {
            throw new Error('username name cannot be empty.');
        }

        if (!password.trim()) {
            throw new Error('password name cannot be empty.');
        }
        
        let postMsg = new LoginMsg();
        postMsg.data.username = username;
        postMsg.data.password = password;
        postMsg.data.clientData = clientData;

        const response = await fetch(`${this.config.conf_server_url}${WebRoutes.login}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postMsg),
        });

        let loginResult = await response.json() as LoginResultMsg;
        console.log(`loginResult`, loginResult);
        return loginResult;

    };

    loginGuest = async (displayName: string, clientData: {}): Promise<LoginResultMsg> => {
        console.log(`loginGuest ${displayName}`);
        if (!displayName.trim()) {
            throw new Error('Display name cannot be empty.');
        }

        let postMsg = new LoginGuestMsg();
        postMsg.data.displayName = displayName;
        postMsg.data.clientData = clientData;

        const response = await fetch(`${this.config.conf_server_url}${WebRoutes.loginGuest}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(postMsg),
        });

        let loginResult = await response.json() as LoginResultMsg;
        console.log(`loginResult`, loginResult);

        return loginResult;
    };

    getConferencesScheduled = async (clientData: {}): Promise<GetConferencesScheduledResultMsg> => {
//        console.log("getConferencesScheduled");

        let post = new apiGetScheduledConferencesPost();
        post.data.clientData = clientData;


        const response = await fetch(`${this.config.conf_server_url}${WebRoutes.getConferencesScheduled}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post),
        });

        return await response.json() as GetConferencesScheduledResultMsg;
    };

    getConferenceScheduled = async (trackingId: string, clientData: {}): Promise<GetConferenceScheduledResultMsg> => {
        //console.log("getConferenceScheduled");

        let post = new apiGetScheduledConferencePost();
        post.data.id = trackingId;
        post.data.clientData = clientData;

        const response = await fetch(`${this.config.conf_server_url}${WebRoutes.getConferenceScheduled}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(post),
        });

        return await response.json() as GetConferenceScheduledResultMsg;
    };

    
};
